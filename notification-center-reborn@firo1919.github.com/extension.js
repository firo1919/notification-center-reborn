/*
Version 24.02 (GNOME 45+ ESM Port)
=============
*/

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Gio from 'gi://Gio';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { spawn as utilSpawn } from 'resource:///org/gnome/shell/misc/util.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const NotificationCenterClass = GObject.registerClass(
class NotificationCenter extends PanelMenu.Button {

  constructor(extension) {
    let prefs = extension.getSettings("org.gnome.shell.extensions.notification-center-reborn");
    super(1 - 0.5 * prefs.get_enum('indicator-pos'), "NotificationCenter");   
    this._extension = extension;
    this.prefs = prefs;
    this._messageList                = Main.panel.statusArea.dateMenu._messageList;
    this._messageListParent          = this._messageList.get_parent();
    this.mediaSection                = this._messageList._mediaSection;
    this.notificationSection         = this._messageList._notificationSection;
    this.eventsSection               = Main.panel.statusArea.dateMenu._eventsItem;
    this.newEventsSectionParent      = this.eventsSection.get_parent();
    this.originalEventsSectionParent = this.newEventsSectionParent; 
    this.dateMenuVbox                = this._messageListParent.get_children()[1];
    
    this.loadPreferences();
    this.connectedSignals     = [];
    this.dmsig                = null;
    this.cmsig                = null;
    this.dndSig               = null;
    this.reloadSignal         = null;
    this.reloadProfilesSignal = null;    
    
    this.textureCache         = St.TextureCache.get_default();
    this.iconThemeChangeSig   = null;
    this.notificationIconName = null;
    
    this.notificationCount = 0;
    this.eventsCount       = 0;
    this.mediaCount        = 0;
    this.seenEvents        = false;
    this.isDndOff          = true;
    this.dndpref           = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });    
     
    this.eventsIcon          = new St.Icon({style_class:'system-status-icon', visible:false, icon_name: "x-office-calendar-symbolic"});
    this.mediaIcon           = new St.Icon({style_class:'system-status-icon', visible:false, icon_name: "audio-x-generic-symbolic"  });
    this.notificationIcon    = new St.Icon({style_class:'system-status-icon', visible:false });
    this.eventsLabel         = new St.Label({text: "•", visible:false, style_class:"notification-center-events-label"});
    this.notificationLabel   = new St.Label({text: "•", visible:false, style_class:"notification-center-notification-label"});
    this._indicator          = new St.BoxLayout({style_class: 'panel-status-menu-box'});
    this.box                 = new St.BoxLayout({style_class: "notification-center-message-list", vertical: true}); 
    this.clearButton         = new St.Button({style_class: "notification-center-clear-button button", label: _("Clear"),can_focus: true,visible:false});
    this.dndItem             = new PopupMenu.PopupSwitchMenuItem(_("Do Not Disturb"),true,{});
    this.noNotificationLabel = new St.Label({text: _("No Notifications"), x_align:2, y_align:3, style:"margin-top: 96px"});
      
    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let monitorHeight = Main.layoutManager.primaryMonitor ? Main.layoutManager.primaryMonitor.height : (global.stage ? global.stage.height : 1080);
    this.scrollView = new St.ScrollView({hscrollbar_policy:2, style:"min-width:"+(this._messageList.width/scaleFactor)+"px;max-height: "+0.01*this.prefs.get_int("max-height")*monitorHeight+"px; max-width: "+(this._messageList.width/scaleFactor)+"px; padding: 0px;"});
    Main.panel.statusArea.dateMenu.menu.box.style = "max-height: "+(0.01*this.prefs.get_int("max-height")*monitorHeight)+"px;";
    
    this.add_style_class_name('notification-center-panel-button');
    this.notificationIcon.set_pivot_point(0.5, 0);    
  }

  _onOpenStateChanged(menu,open) {
    if(!open) {
      this.resetIndicator();
      this.remove_style_pseudo_class('active');
      return ;
    }
    Main.panel.statusArea.dateMenu._calendar.setDate(new Date()); 
    this.add_style_pseudo_class('active');
    this.manageEvents(0);
    [ this.mediaSection.visible, this.notificationSection.visible ] = [ this.mediaSection._shouldShow(), this.notificationSection._list.get_children().length ];
    this.blinkIconStopIfBlinking();

    if(!this.showLabel) {
      this.notificationCount=0;
      this.eventsCount=0;
    }
    this.seenEvents = true;
    this.resetIndicator();
  }

  animateOnNewNotification(times, op=254, angle=3) {
    [ this.visible, this.notificationIcon.visible ] = [ true, true ];
    if(times === 0 || this.notAnimateIcon) {
      this.notificationIcon.ease({
        duration:         150,
        scale_x:          1.0,
        scale_y:          1.0,
        translation_y:    0,
        opacity:          255,
        rotation_angle_z: 0,
        onComplete: ()=>  this.blinkIcon(!this.menu.isOpen*this.blinkCount, this.blinkTime, 100)
      });
      return;
    }
  
    this.notificationIcon.ease({
      duration:         150,
      scale_x:          1.2,
      scale_y:          1.2,
      translation_y:    -4,
      opacity:          op,
      rotation_angle_z: angle,
      onComplete: ()=>  this.animateOnNewNotification(--times, op-1, -angle)
    });
  }

  blinkIcon(blinkTimes, interval, opacity) {
    this.manageAutohide();
    if(blinkTimes > 0) {
      this.notificationIcon.ease({
        duration:   interval,
        opacity:    opacity,
        onComplete: ()=> this.blinkIcon(--blinkTimes,interval,(opacity===255)?100:255)
      });
    }
  }

  blinkIconStopIfBlinking() {
    this.notificationIcon.remove_all_transitions();
    this.notificationIcon.set_opacity(255);
  }

  dndToggle() {
    this.dndpref.set_boolean('show-banners',!this.dndpref.get_boolean('show-banners'));
  }

  loadDndStatus() {
    this.isDndOff = this.dndpref.get_boolean("show-banners");
    this.dndItem.setToggleState(!this.isDndOff);

    this.blinkIconStopIfBlinking();
    this.manageAutohide();

    this.notificationIcon.icon_name = this.notificationIconName;

    if(this.isDndOff) {
      this.notificationIcon.set_opacity(255);
      this.manageLabel();
      return false;
    }
 
    if(Gtk.IconTheme.get_default())  {
      if(Gtk.IconTheme.get_default().has_icon("notifications-disabled-symbolic")) {
        this.notificationIcon.icon_name = "notifications-disabled-symbolic";
      }
    }
    else {
      this.notificationIcon.set_opacity(150);
    }

    [ this.notificationLabel.visible, this.eventsLabel.visible] = [ false, false ];
    
    return true;
  }

  loadPreferences() {
    this.autohide                     = this.prefs.get_int("autohide");
    this.mediaSectionToBeShown        = (this.prefs.get_int("show-media")>0)?true:false;
    this.notificationSectionToBeShown = (this.prefs.get_int("show-notification")>0)?true:false;
    this.eventsSectionToBeShown       = (this.prefs.get_int("show-events")>0)?true:false;
    this.eventsSectionPosition        = this.prefs.get_enum("events-position");  // 0 = below, 1 = dont show, 2 = beside
    this.hideEmptySpace               = this.prefs.get_boolean("autohide-space-beside-calendar");
    this.showEventsInCalendarAlso     = (this.eventsSectionToBeShown && this.eventsSectionPosition !== 1) ? true: false;
    this.showEventsSectionIfEmpty     = this.prefs.get_boolean("show-events-section-if-empty"); 
    this.showThreeIcons               = this.prefs.get_boolean("individual-icons");
    this.includeEventsCount           = this.prefs.get_boolean("include-events-count");
    this.newNotificationAction        = this.prefs.get_enum("new-notification");
    this.eventsSectionhere            = this.showEventsInCalendarAlso;
    this.showingSections              = this.prefs.get_strv("sections-order");
    this.appBlackList                 = this.prefs.get_strv("name-list");
    this.scriptList                   = this.prefs.get_strv("script-list");
    this.allowRunningScript           = this.prefs.get_boolean("run-script");
    this.blackListAction              = this.prefs.get_enum("for-list"); 
    this.notAnimateIcon               = !this.prefs.get_boolean("animate-icon");
    this.blinkTime                    = this.prefs.get_int("blink-time");
    this.blinkCount                   = this.prefs.get_int("blink-icon")*2;
    this.showLabel                    = this.prefs.get_boolean("show-label");
    this.changeIcons                  = this.prefs.get_boolean("change-icons");  
  }

  // eslint-disable-next-line complexity
  manageAutohide() {
    if(!this.menu.isOpen) {
      this.mediaIcon.visible        = this.mediaSection._shouldShow() && this.showThreeIcons && this.mediaSectionToBeShown;
      this.eventsIcon.visible       = (this.shouldShowEventsSection()) && this.showThreeIcons && this.eventsSectionToBeShown;
      this.notificationIcon.visible = (this.notificationSection._list.get_children().length && this.notificationSectionToBeShown) ||
                                      (this.mediaSection._shouldShow() && this.mediaSectionToBeShown && !this.showThreeIcons) ||
                                      ((this.shouldShowEventsSection()) && this.eventsSectionToBeShown && !this.showThreeIcons) ||
                                      ((!this.isDndOff)*this.autohide > 1);
      if(this.mediaIcon.visible || this.eventsIcon.visible || this.notificationIcon.visible || !this.autohide) {
        this.visible = true;
        this.notificationIcon.visible = (this.mediaIcon.visible || this.eventsIcon.visible) ? this.notificationIcon.visible : true;
        return;
      }
      this.visible = false;
    }
    else {
      this.noNotificationLabel.visible = !((this.mediaSection._shouldShow() && this.mediaSectionToBeShown) || (this.notificationSection._list.get_children().length && this.notificationSectionToBeShown) || ((this.shouldShowEventsSection() || this.showEventsSectionIfEmpty) && this.eventsSectionToBeShown));
      this.box.style_class = (this.noNotificationLabel.visible) ? "notification-center-message-list-empty" : "notification-center-message-list";      
    }
  }

  manageEvents(action) {
    this.eventsSection.visible = this.showEventsSectionIfEmpty || this.shouldShowEventsSection() ;       
    if(this.showEventsInCalendarAlso === true) {
      switch(action) {
        case 0:
          if(this.eventsSectionhere === true) {
            return;
          }
          this.removeSection(this.eventsSection);
          this.box.insert_child_at_index(this.eventsSection,this.showingSections.indexOf("events"));
          this.eventsSectionhere = true;
          return;
        case 1:
          if(this.eventsSectionhere === false) {
            return;
          }
          this.box.remove_child(this.box.get_children()[this.showingSections.indexOf("events")]);
          this.newEventsSectionParent.insert_child_at_index(this.eventsSection, this.eventsSectionPosition);
          this.eventsSectionhere = false;
          return;
      }
    }
  }

  manageLabel(nCount,eCount) {
    this.notificationLabel.visible = nCount*this.newNotificationAction;
    this.eventsLabel.visible = eCount*this.newNotificationAction && (this.shouldShowEventsSection() > 0);

    if (this.changeIcons) {
      this.manageIconChange(nCount > 0 || eCount > 0);
    }

    if(this.newNotificationAction === 2) {
      if(nCount>0) {
        this.notificationLabel.text=nCount.toString();
      }
      if(eCount > 0 ) {
        this.eventsLabel.text=eCount.toString();
      }
    }
  }

  manageIconChange(statusIcon) {
    let iconName = statusIcon ? "notification-center-full" : "notification-center-empty";
    this.notificationIcon.icon_name = iconName;
  }

  middleClickDndToggle(actor, event) {
    switch(event.get_button()) {
      case 2: // if middle click
        // close the menu, since it gets open on any click
        if (this.menu.isOpen) {
          this.menu.actor.visible = false;
        }
        // toggle DND state
        this.dndToggle();
        // reload dnd status
        this.loadDndStatus();
        return;
      }
  }

  newNotif(messageType) {
    switch(messageType) {
      case "media":
        this.mediaCount++;
        break;
      case "notification" : {
        this.notificationCount = this.notificationCount+ !this.menu.isOpen;
        let source = Main.messageTray.getSources();
        let applicationIndex = this.appBlackList.indexOf(source[source.length-1].title);
        if(this.allowRunningScript && applicationIndex > 0 && this.scriptList[applicationIndex]!=="") {
          utilSpawn(["sh", this.scriptList[applicationIndex]]);         
        }
        if(this.isDndOff) {
          if(applicationIndex > -1) {
            switch(this.blackListAction) {
              case 3:  
              case 2:
                this.notificationCount--;
            }
          }
          this.animateOnNewNotification(5);
        }
        break;
      }
      case "events" :  
        [ this.seenEvents, this.eventsCount ] = [ (Main.panel.statusArea.dateMenu.menu.isOpen)? this.seenEvents: false, this.shouldShowEventsSection()*(!this.menu.isOpen) ];
        break;
    }
    this.resetIndicator();
  }

  remNotif(messageType) {
    switch(messageType) {
      case "media" :
        this.mediaCount--;
        break;
      case "notification" :
        (this.notificationCount>0)? this.notificationCount-- : 0;
        break;
      case "events" :
        this.eventsCount = this.shouldShowEventsSection();
        break;
    }
    this.resetIndicator();
  }
  
  removeSection(section) {
    if(section === this.eventsSection) {
      this.newEventsSectionParent.remove_actor(this.eventsSection);
      return ;
    } 

    this._messageList._sectionList.remove_actor(section);
    this._messageList._sync();
  }

  resetIndicator() {
    this.manageAutohide();
    this.clearButton.visible = this.notificationSection._canClear && this.notificationSectionToBeShown;
    this.eventsCount = this.eventsCount*this.includeEventsCount;   
    if(this.isDndOff ) {
      this.manageLabel((this.notificationCount + (!this.showThreeIcons)*this.eventsCount) ,(this.showThreeIcons)*this.eventsCount);
    }
  }

  setNotificationIconName() {
    if(Gtk.IconTheme.get_default()) {
      this.notificationIconName = Gtk.IconTheme.get_default().has_icon("notification-symbolic")?"notification-symbolic":"preferences-system-notifications-symbolic";
    }
    else {
      this.notificationIconName = "preferences-system-notifications-symbolic";
    }
  }

  iconThemeChanged() {
    this.setNotificationIconName();
    this.loadDndStatus();
  }
  
  shouldShowEventsSection() {
    switch(this.eventsSection._eventsList.get_children().length) {
      case 0:
        return 0;
      default:
        return (this.eventsSection._eventsList.get_children()[0].style_class === 'event-placeholder') ? 0: this.eventsSection._eventsList.get_children().length;
    }
  }  

  startNotificationCenter() {
    if(this.prefs.get_double("current-version") < 23.03) {    
      Main.notify("Notification Center","Extension is updated. Please Complete the update process in the extension preferences.");
      return;
    }

    this._indicator.add_child(this.eventsIcon);
    this._indicator.add_child(this.eventsLabel);
    this._indicator.add_child(this.mediaIcon);
    this._indicator.add_child(this.notificationIcon);
    this._indicator.add_child(this.notificationLabel);

    this.setNotificationIconName();
    this.iconThemeChangeSig = this.textureCache.connect('icon-theme-changed', this.iconThemeChanged.bind(this));

    this.add_child(this._indicator);
    Main.panel.addToStatusArea("NotificationCenter", this, this.prefs.get_int('indicator-index'), this.prefs.get_string('indicator-pos'));
   
    this.eventsSection.allowed = true;  // Compatibility with this._messageList
    if(this.eventsSectionPosition === 2) { // Shows Events Section beside Calendar
      this.newEventsSectionParent.remove_actor(this.eventsSection);
      this.newEventsSectionParent = this._messageList._sectionList;
      this.newEventsSectionParent.insert_child_at_index(this.eventsSection, 2);
    }

    if(this.showingSections.length === 3 && !this.showEventsInCalendarAlso) {
      this.dateMenuVbox.style = "border-width: 0px";
    }    
    this._messageListParent.remove_actor(this._messageList); 
    if(this.prefs.get_boolean("calendar-on-left")) {
      this._messageListParent.insert_child_at_index(this._messageList, 1);
      this.dateMenuVbox.add_style_class_name("notification-center-datemenu-vbox");
    }
    else {
      this._messageListParent.insert_child_at_index(this._messageList, 0);
    }
    for(let i=0;i<this.showingSections.length;i++) {
      if(this.showingSections[i] === "events") {
        this.newEventsSectionParent.remove_actor(this.eventsSection);
        this.box.add(this.eventsSection);
        this.connectedSignals.push(this.eventsSection._eventsList.connect('actor-added'   ,()=> this.newNotif(this.showingSections[i]) ));
        this.connectedSignals.push(this.eventsSection._eventsList.connect('actor-removed' ,()=> this.remNotif(this.showingSections[i]) ));
        this.eventsSection.setDate(new Date()); 
      }    
      else {
        this.removeSection(this[this.showingSections[i]+"Section"]);
        this.box.add(this[this.showingSections[i]+"Section"]);
        this.connectedSignals.push(this[this.showingSections[i]+"Section"]._list.connect('actor-added'   ,()=> this.newNotif(this.showingSections[i]) ));
        this.connectedSignals.push(this[this.showingSections[i]+"Section"]._list.connect('actor-removed' ,()=> this.remNotif(this.showingSections[i]) ));
        this[this.showingSections[i]+"Section"].add_style_class_name('notification-center-message-list-section');
      }
    }
 
    this.scrollView._delegate = this;
    this.scrollView.add_actor(this.box);
    this.box.add_child(this.noNotificationLabel);
    this.menu.box.add_child(this.scrollView);

    let clearButtonPos = this.prefs.get_enum("clear-button-alignment");
    if(clearButtonPos!==3){
      this.clearButton.connect('clicked', ()=> {
        this.notificationSection.clear();
      }); 
      this.clearButton.set_x_align(1+clearButtonPos);
      this.menu.box.add_child(this.clearButton);
    }
    this._messageList._clearButton.opacity = 255*(!this.notificationSectionToBeShown);
    
    switch(this.prefs.get_enum("dnd-position")) {
      case 1:
        this.dndItem._delegate = this;
        this.dndItem.connect("toggled", ()=>this.dndToggle());
        if (this._messageList._dndSwitch) this._messageList._dndSwitch.visible = false;
        if (this._messageList._dndButton) this._messageList._dndButton.label_actor.visible = false;
        this.menu.box.insert_child_at_index(new PopupMenu.PopupSeparatorMenuItem(), 0);
        this.menu.box.insert_child_at_index(this.dndItem, 0);
        break;
      case 2:
        this.dndItem.connect("toggled", ()=>this.dndToggle());
        if (this._messageList._dndSwitch) this._messageList._dndSwitch.visible = false;
        if (this._messageList._dndButton) this._messageList._dndButton.label_actor.visible = false;
        this.menu.box.add_child(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.box.add_child(this.dndItem);      
    }
    
    this.loadDndStatus();
    this.resetIndicator();
    
    let bannerPos = this.prefs.get_string('banner-pos');
    Main.messageTray._bannerBin.set_y_align(bannerPos[0]);
    Main.messageTray.bannerAlignment = bannerPos[1];
    Main.panel.statusArea.dateMenu.get_children()[0].remove_actor(Main.panel.statusArea.dateMenu._indicator);
    this.dtActors=Main.panel.statusArea.dateMenu.get_children()[0].get_children();
    Main.panel.statusArea.dateMenu.get_children()[0].remove_actor(this.dtActors[0]);

    Main.wm.addKeybinding(
      'indicator-shortcut',
      this.prefs,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
      () => {
        this.notificationIcon.visible = !(this.mediaIcon.visible || this.eventsIcon.visible); 
        this.visible = true;
        this.menu.toggle();        
      }
    );    

    this.dndSig = this.dndpref.connect("changed::show-banners", () => {
      this.loadDndStatus();
    });

    if(this.prefs.get_boolean("middle-click-dnd")) {
      this.connect("button-press-event", (actor, event)=>this.middleClickDndToggle(actor, event));
    }

    this.unFreezeSig = Main.panel.statusArea.dateMenu._calendar.connect('selected-date-changed', (_calendar, _datetime) => {
      this._messageList.get_parent().get_parent().layout_manager.frozen = false;
      switch(this.eventsSectionPosition) {
        case 2:
          [ this.eventsSection.visible, this.dateMenuVbox.style ] = [ ( this.showEventsSectionIfEmpty || this.shouldShowEventsSection()), "" ];
          this._messageList._sync();
          return;
        case 0:
          this.eventsSection.visible = (this.showEventsSectionIfEmpty || this.shouldShowEventsSection());
      }
    });
    
    this.dmSig = Main.panel.statusArea.dateMenu.menu.connect("open-state-changed",()=> {
      if (Main.panel.statusArea.dateMenu.menu.isOpen) {
        if(this.eventsSectionPosition !== 1) { 
          this.manageEvents(1);
          if(this.showLabel===false) {
            this.eventsCount=0;
          }
          this.resetIndicator();
        } 
        this._messageList._sync();
        if(this.hideEmptySpace) {
          this._messageList.visible = !this._messageList._placeholder.visible;
        }
        this.dateMenuVbox.style = (this._messageList.visible) ? "" : "border-width: 0px";
      }
      else {
        Main.panel.statusArea.dateMenu._calendar.setDate(new Date());    
        this.eventsCount = (this.seenEvents) ? 0 : this.eventsCount;
        this.resetIndicator();
      }        
    });
    
    if(this.prefs.get_boolean("autoclose-menu")) {
      this.cmsig = global.display.connect('notify::focus-window', () => {
        if(global.display.focus_window!== null && this.menu.isOpen) {
          this.menu.close(1);    
        }
      });
    }
    
    Main.panel.statusArea.dateMenu._date.visible = !this.prefs.get_boolean("hide-date-section");
    if(this.prefs.get_boolean("hide-weather-section")) {
      this.originalEventsSectionParent.remove_actor(Main.panel.statusArea.dateMenu._weatherItem);
    }
    if(this.prefs.get_boolean("hide-clock-section")) {
      this.originalEventsSectionParent.remove_actor(Main.panel.statusArea.dateMenu._clocksItem);
    }    
  }
  
  undoChanges() {
    if(this._indicator.get_children().length === 0) {    
      return;
    }

    this.blinkIconStopIfBlinking();
    this._messageListParent.remove_actor(this._messageList); 
    this._messageListParent.insert_child_at_index(this._messageList,0);  
    this.dateMenuVbox.style="";
    this.dateMenuVbox.remove_style_class_name("notification-center-datemenu-vbox");
    if (this._messageList._dndSwitch) this._messageList._dndSwitch.visible = true;
    if (this._messageList._dndButton) this._messageList._dndButton.label_actor.visible = true;
    
    this.manageEvents(0);

    let len=this.showingSections.length;
    while(len!==0) {
      if(this.showingSections[len-1] === "events") {
        this[this.showingSections[len-1]+"Section"]._eventsList.disconnect(this.connectedSignals[2*len-1]);
        this[this.showingSections[len-1]+"Section"]._eventsList.disconnect(this.connectedSignals[2*len-2]);

        this.box.remove_child(this.box.get_children()[len-1]);
        this.newEventsSectionParent.add_actor(this.eventsSection);
      }    
      else {
        this[this.showingSections[len-1]+"Section"]._list.disconnect(this.connectedSignals[2*len-1]);
        this[this.showingSections[len-1]+"Section"]._list.disconnect(this.connectedSignals[2*len-2]);

        this.box.remove_child(this.box.get_children()[len-1]);
        this._messageList._addSection(this[this.showingSections[len-1]+"Section"]);
     }
      this[this.showingSections[len-1]+"Section"].remove_style_class_name('notification-center-message-list-section');
      this.connectedSignals.pop();
      this.connectedSignals.pop();
      len--;
    }    

    this.eventsSection.allowed = false;
    [ this.mediaSection.visible, this.notificationSection.visible, this.eventsSection.visible ] = [ true, true, true ]; 
    this.removeSection(this.mediaSection);
    this.removeSection(this.notificationSection);
    this.removeSection(this.eventsSection);

    this._messageList._addSection(this.mediaSection);
    this._messageList._addSection(this.notificationSection);
    this.originalEventsSectionParent.insert_child_at_index(this.eventsSection,0);  
    this._messageList._clearButton.opacity = 255;
    Main.messageTray.bannerAlignment = 2;
    Main.messageTray._bannerBin.set_y_align(1);

    Main.panel.statusArea.dateMenu.menu.disconnect(this.dmSig);
    Main.panel.statusArea.dateMenu._calendar.disconnect(this.unFreezeSig);
    
    if(this.cmsig !== null) {
      global.display.disconnect(this.cmsig);
    }

    if(this.dndSig !== null){
      this.dndpref.disconnect(this.dndSig);
    }
    if (this.dndItem) {
      this.dndItem.destroy();
    }

    if(this.iconThemeChangeSig!==null){
      this.textureCache.disconnect(this.iconThemeChangeSig);
    }

    Main.panel.statusArea.dateMenu.get_children()[0].insert_child_at_index(this.dtActors[0],0);
    Main.panel.statusArea.dateMenu.get_children()[0].insert_child_at_index(Main.panel.statusArea.dateMenu._indicator, 2);
    
    if(Main.panel.statusArea.dateMenu._clocksItem.get_parent() === null) {
      this.originalEventsSectionParent.insert_child_at_index(Main.panel.statusArea.dateMenu._clocksItem, 1);
    }
    if(Main.panel.statusArea.dateMenu._weatherItem.get_parent() === null) {
      this.originalEventsSectionParent.insert_child_at_index(Main.panel.statusArea.dateMenu._weatherItem, 2);
    }
    Main.panel.statusArea.dateMenu._date.visible  = true;
    Main.wm.removeKeybinding('indicator-shortcut');

    this.eventsIcon.destroy();
    this.eventsLabel.destroy();
    this.mediaIcon.destroy();
    this.notificationIcon.destroy();
    this.notificationLabel.destroy();
    this.noNotificationLabel.destroy();
    this._indicator.destroy();

    this.clearButton.destroy();
    this.box.destroy();
    this.scrollView.destroy();
  }
});

export default class NotificationCenterExtension extends Extension {
    enable() {
        this.notificationCenter = new NotificationCenterClass(this);
        this.notificationCenter.startNotificationCenter();
        
        this.reloadSignal = this.notificationCenter.prefs.connect("changed::reload-signal", () => {
            this.disable();
            this.enable();
        });
        
        this.reloadProfilesSignal = this.notificationCenter.prefs.connect("changed::reload-profiles-signal", () => {
            this.notificationCenter.loadPreferences();
        });
    }

    disable() {
        if (this.notificationCenter) {
            this.notificationCenter.prefs.disconnect(this.reloadSignal);
            this.notificationCenter.prefs.disconnect(this.reloadProfilesSignal);
            this.notificationCenter.undoChanges();
            this.notificationCenter.destroy();
            this.notificationCenter = null;
        }
    }
}

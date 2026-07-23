import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

let settings = null;

function reloadExtension() {
  (settings.get_boolean("reload-signal")) ? settings.set_boolean("reload-signal", false) : settings.set_boolean("reload-signal", true);
}

function reloadApplicationProfiles() {
  (settings.get_boolean("reload-profiles-signal")) ? settings.set_boolean("reload-profiles-signal", false) : settings.set_boolean("reload-profiles-signal", true);
}

const _ExtensionResetButton_NotificationCenterExtensionClass = GObject.registerClass(
class ExtensionResetButton_NotificationCenterExtension extends Gtk.Button {
  constructor(object) {
    super({label: _("Reset Notification Center Extension"), halign: Gtk.Align.CENTER});
    this.connect('clicked', () => { this.resetExtension(object, "updateDone", null) });    
  }
  
  resetExtension(object, functionToBeCalledAtTheEnd, parameter) {
    let dialog = new Gtk.MessageDialog({ transient_for: object.get_native ? object.get_native() : object, modal: true });  
    dialog.set_default_response(Gtk.ResponseType.OK);
    dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    dialog.add_button("OK", Gtk.ResponseType.OK);
    dialog.set_markup("<big><b>"+_("Reset Notification Center to defaults?")+"</b></big>");
    dialog.get_message_area().append(new Gtk.Label({ wrap: true, justify: 3, use_markup: true, label: _("Resetting the extension will discard the current preferences configuration and restore default one.")}));
    dialog.connect('response', (_dialog, id) => {
      if(id !== Gtk.ResponseType.OK) {
        dialog.destroy();  
        return;
      }
  
      settings.reset("show-media");
      settings.reset("show-notification");
      settings.reset("show-events");
      settings.reset("events-position");
      settings.reset("autohide-space-beside-calendar");
      settings.reset("calendar-on-left");
      settings.reset("show-events-section-if-empty");
      settings.reset("sections-order");
      settings.reset("dnd-position");
      settings.reset("clear-button-alignment");
      settings.reset("autoclose-menu");
      settings.reset("indicator-shortcut");
      settings.reset("max-height");
      settings.reset("hide-clock-section");
      settings.reset("hide-weather-section");
      settings.reset("hide-date-section");
      settings.reset("banner-pos");

      settings.reset("indicator-pos");
      settings.reset("indicator-index");
      settings.reset("individual-icons");
      settings.reset("change-icons");
      settings.reset("autohide");
      settings.reset("new-notification");
      settings.reset("include-events-count");
      settings.reset("blink-icon");
      settings.reset("blink-time");
      settings.reset("animate-icon");    
      settings.reset("show-label");
      settings.reset("middle-click-dnd");
          
      settings.reset("application-list");
      settings.reset("name-list");
      settings.reset("script-list");
      settings.reset("for-list");
      settings.reset("run-script");

      dialog.destroy();
      if(object && object[functionToBeCalledAtTheEnd]) {
        object[functionToBeCalledAtTheEnd]( parameter );
      }
          
      reloadExtension();
    });
    
    dialog.present();
  } 
});

const PrefsWindow_NotificationCenterExtensionClass = GObject.registerClass(
class PrefsWindow_NotificationCenterExtension extends Gtk.Grid {
  constructor() {
    super({ column_spacing: 20, halign: Gtk.Align.CENTER,  margin_top: 20, margin_end: 20, margin_bottom: 20, margin_start: 20, row_spacing: 20 });
  }

  attachLabel(KEY, pos, box) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_summary()), halign: Gtk.Align.START});
    if (box) {
        box.attach(prefLabel, 0, pos, 1, 1);
    } else {
        this.attach(prefLabel, 0, pos, 1, 1);
    }
  }
   
  prefCombo(KEY, pos, options, items, box) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', (widget) => {
      settings.set_string(KEY, options[widget.get_active()]);
      reloadExtension();
    });
    
    this.attachLabel(KEY, pos, box);
    if (box) {
        box.attach(SettingCombo, 1, pos, 1, 1);
    } else {
        this.attach(SettingCombo, 1, pos, 1, 1);
    }
  }

  prefStr(KEY, pos, options, items) {
    let SettingCombo  = new Gtk.ComboBoxText();
    for (let i=0;i<options.length;i++) {
      SettingCombo.append(options[i], items[i]);
    }
    
    let keyVal=settings.get_strv(KEY);
    let strSetting = new Gtk.Entry({text:keyVal[0].substring(1+keyVal[0].indexOf('>'))});
    let box = new Gtk.Box({halign:Gtk.Align.END});
    
    strSetting.set_width_chars(1);
    SettingCombo.set_active(options.indexOf(keyVal[0].substring(0,1+keyVal[0].indexOf('>'))));
    SettingCombo.connect('changed', (widget) => {  
      keyVal.pop(); 
      keyVal.push(options[widget.get_active()]+strSetting.text);
      settings.set_strv(KEY,keyVal);
    });
    
    strSetting.connect('changed', () => {  
      keyVal.pop(); 
      keyVal.push(options[SettingCombo.get_active()]+strSetting.text);
      settings.set_strv(KEY,keyVal);
    });
    
    box.append(SettingCombo);
    box.append(new Gtk.Label({label: "  +  "}));
    box.append(strSetting);
    
    this.attachLabel(KEY,pos);
    this.attach(box, 1, pos, 1, 1);
  }
  
  prefSwitch(KEY, pos, box) {
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", (button) => {
      settings.set_boolean(KEY, button.active);
      reloadExtension();
    });
    this.attachLabel(KEY, pos, box);
    if (box) {
        box.attach(SettingSwitch, 1, pos, 1, 1);
    } else {
        this.attach(SettingSwitch, 1, pos, 1, 1);
    }
  }

  prefTime(KEY, pos, mn, mx, st) {
    let timeSetting = Gtk.SpinButton.new_with_range(mn, mx, st);
    timeSetting.set_value(settings.get_int(KEY));
    timeSetting.connect('notify::value', (spin) => {
      settings.set_int(KEY,spin.get_value_as_int());
    });

    this.attachLabel(KEY,pos);
    this.attach(timeSetting, 1, pos, 1, 1);
  }
});

const PrefsWindowForAppList_NotificationCenterExtensionClass = GObject.registerClass(
class PrefsWindowForAppList_NotificationCenterExtension extends Gtk.Grid {
  constructor() {
    super();
  }

  appViewChange() {
    let applicationList = settings.get_strv("application-list");
    let nameList = settings.get_strv("name-list");
    let [any, _model, iter] = this.treeView.get_selection().get_selected();
    if(any) {
      let appInfo = this._store.get_value(iter, 0); 
      this.selectedIndex=applicationList.indexOf(appInfo.get_id());
    }
    if(this.selectedIndex >= 0 ) {
      let scriptList = settings.get_strv('script-list');
      this.scriptLocation.text = scriptList[this.selectedIndex];
      this.scriptLocation.sensitive = true; 
      this.browseButton.sensitive = true;
      this.AppLabel.label = _("Custom script location for")+" "+nameList[this.selectedIndex];
      let appInfo = this._store.get_value(iter, 0); 
      this.AppIcon.gicon = appInfo.get_icon();      
    } else {
      this.scriptLocation.text = "";
      this.scriptLocation.sensitive = false;
      this.browseButton.sensitive = false;
      this.AppIcon.gicon = null;
    }
    this.setButton.sensitive = false;
  }

  attachLabel(KEY, pos, box) {
    let prefLabel = new Gtk.Label({xalign: 1, label: _(settings.settings_schema.get_key(KEY).get_summary()), halign: Gtk.Align.START});
    box.attach(prefLabel,0,pos,1,1);
  }
 
  addApp() {
    let appDialog = new Gtk.Dialog({ title: _('Choose an application'), transient_for: this.get_native(), use_header_bar: true, modal: true });
    appDialog._appChooser = new Gtk.AppChooserWidget({ margin_top: 5, margin_end: 5, margin_bottom: 5, margin_start: 5, show_all: true, vexpand: true });
    appDialog.set_default_response(Gtk.ResponseType.OK);
    appDialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
    appDialog.add_button(_("Add"), Gtk.ResponseType.OK);
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, hexpand:true, vexpand:true});
    hbox.append(appDialog._appChooser);
    appDialog.get_content_area().append(hbox);
    appDialog.connect('response', (_dialog, id) => {
      if (id !== Gtk.ResponseType.OK) {
        appDialog.destroy();
        return;
      }

      let appInfo = appDialog._appChooser.get_app_info();
      if (!appInfo) return;

      let applicationList = settings.get_strv('application-list');
      let nameList = settings.get_strv('name-list');
      let scriptList = settings.get_strv('script-list');
      if (applicationList.indexOf(appInfo.get_id())>=0) {
        appDialog.destroy();
        return;
      }
      applicationList.push(appInfo.get_id());
      nameList.push(appInfo.get_name());
      scriptList.push("");
      settings.set_strv('application-list', applicationList);
      settings.set_strv('name-list', nameList);
      settings.set_strv('script-list', scriptList);
      this._store.set(this._store.append(), [0, 2, 1], [appInfo, appInfo.get_icon(), appInfo.get_name()]);
      reloadApplicationProfiles();

      appDialog.destroy();
    });
    
    appDialog.present();
  }

  displayPrefs() {
    this.makeList();
    this.showPrefs();
    this.refreshList();
  }

  makeList() {
    this._store = new Gtk.ListStore();
    this._store.set_column_types([Gio.AppInfo, GObject.TYPE_STRING, Gio.Icon]);
    this.treeView = new Gtk.TreeView({ model: this._store, hexpand: true, vexpand: true, halign: Gtk.Align.START});

    let iconRenderer = new Gtk.CellRendererPixbuf;
    let nameRenderer = new Gtk.CellRendererText;
    let appColumn    = new Gtk.TreeViewColumn({expand: true, resizable:true, alignment: 0.5, sort_column_id: 1, title:_("Application List")});
    let listBox   = new Gtk.ScrolledWindow({hexpand: true});
    
    appColumn.pack_start(iconRenderer, false);
    appColumn.pack_start(nameRenderer, true);
    appColumn.add_attribute(iconRenderer, "gicon", 2);
    appColumn.add_attribute(nameRenderer, "text", 1);
    
    this.treeView.append_column(appColumn);
    appColumn.set_fixed_width(370);
    listBox.set_child(this.treeView);
    this.attach(listBox,0,0,1,1);
  }

  prefCombo(KEY, pos, options, items, box) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(options.indexOf(settings.get_string(KEY)));
    SettingCombo.connect('changed', (widget) => {
      settings.set_string(KEY, options[widget.get_active()]);
      settings.get_strv('application-list').forEach((application) => {
        this.setNotificationBannerPolicy("/org/gnome/desktop/notifications/application/"+application.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').substring(0,application.length-8)+"/", widget.get_active());
      });
      reloadApplicationProfiles();
    });
    
    this.attachLabel(KEY,pos,box);
    box.attach(SettingCombo, 1, pos, 1, 1);
  }
    
  prefSwitch(KEY, pos, box) {
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", (button) => {
      settings.set_boolean(KEY, button.active);
      reloadExtension();
    });
    this.attachLabel(KEY, pos, box);
    box.attach(SettingSwitch, 1, pos, 1, 1);
  }  

  refreshList()  {
    this._store.clear();
    let applicationList = settings.get_strv('application-list');
    let nameList = settings.get_strv('name-list');
    let scriptList = settings.get_strv('script-list');

    for (let i = 0; i < applicationList.length; i++) {
      let appInfo = Gio.DesktopAppInfo.new(applicationList[i]);
      if (appInfo === null) {
        applicationList.splice(i,1);
        nameList.splice(i,1);
        scriptList.splice(i,1);
        i--;
      } else {
        this._store.set(this._store.append(), [0, 2, 1], [appInfo, appInfo.get_icon(), nameList[i]]);
      }
    }
    
    settings.set_strv('application-list', applicationList);
    settings.set_strv('name-list', nameList);
    settings.set_strv('script-list', scriptList);
  }

  removeApp() {
    let [any, _model, iter] = this.treeView.get_selection().get_selected();
    let applicationList = settings.get_strv('application-list');
    let nameList = settings.get_strv('name-list');
    let scriptList = settings.get_strv('script-list');

    if (any) {
      let indx, appInfo = this._store.get_value(iter, 0); 
      applicationList.splice((indx=applicationList.indexOf(appInfo.get_id())),1);
      nameList.splice(indx,1);
      scriptList.splice(indx,1);
      this.selectedIndex= -1;
      settings.set_strv('application-list', applicationList);
      settings.set_strv('name-list', nameList);
      settings.set_strv('script-list', scriptList);
      this._store.remove(iter);
    }

    reloadApplicationProfiles();
  }

  fileManagementDialogWindow(action) {
    let fileFormats  = new Gtk.FileFilter();        
    let fileDialog       = new Gtk.FileChooserDialog({ title: _("Choose a Script file")+" ", action: action, filter: fileFormats, transient_for: this.get_native(), use_header_bar: true, modal: true });
    fileDialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
    fileDialog.add_button(_("Set"), Gtk.ResponseType.OK);
        
    fileFormats.add_pattern("*.sh");    
    fileDialog.present();
    
    fileDialog.connect('response', (_dialog, id) => {
      if(id === Gtk.ResponseType.OK) {
        this.scriptLocation.text = fileDialog.get_file().get_path();
      }
      fileDialog.destroy();
    });
  }

  showPrefs() {
    let box             = new Gtk.Grid({ column_spacing: 20, halign: Gtk.Align.CENTER, margin_top: 20, margin_end: 20, margin_bottom: 20, margin_start: 20, row_spacing: 20 });
    let addButton       = new Gtk.Button({label: _("     Add    "), halign: Gtk.Align.START});
    let delButton       = new Gtk.Button({label: _(" Remove "), halign: Gtk.Align.END});
    this.scriptLocation = new Gtk.Entry({text: "", sensitive: false });
    this.setButton      = new Gtk.Button({label: _("Set"), halign: Gtk.Align.END, sensitive: false});
    this.clearButton    = new Gtk.Button({label: _("Clear"), halign: Gtk.Align.START, sensitive: false});
    this.browseButton   = new Gtk.Button({label: _("Browse"), halign: Gtk.Align.START, sensitive: false});
    
    this.AppLabel       = new Gtk.Label({ xalign:  1, use_markup: true, halign: Gtk.Align.CENTER });
    this.AppIcon        = new Gtk.Image({ gicon: null, pixel_size: 96 });
    this.iconImageBox   = new Gtk.Box({halign: Gtk.Align.CENTER});
    this.iconImageBox.append(this.AppIcon);
    
    this.AppLabel.label = _("No application selected");    
    
    this.selectedIndex  = -1;
    addButton.connect('clicked', () => this.addApp());
    delButton.connect('clicked', () => this.removeApp());
    this.browseButton.connect("clicked", () => this.fileManagementDialogWindow(0));
    this.scriptLocation.connect("changed", () => {
      if(this.scriptLocation.text !== "") {
        this.setButton.sensitive = true;
        this.clearButton.sensitive = true;
      } else {
        this.setButton.sensitive = false;
        this.clearButton.sensitive = false;
      }
    });
    this.setButton.connect('clicked', () => {
      if(this.selectedIndex > -1) {
        let scriptList = settings.get_strv('script-list');
        scriptList[this.selectedIndex] = this.scriptLocation.text;
        settings.set_strv('script-list', scriptList);
      }
    });
    this.clearButton.connect('clicked', () => {
      if(this.selectedIndex > -1) {
        let scriptList = settings.get_strv('script-list');
        this.scriptLocation.text = "";
        scriptList[this.selectedIndex] = "";
        settings.set_strv('script-list', scriptList);
      }
    });
    
    box.attach(addButton,                                                                                                                        0, 0,  1, 1);
    box.attach(delButton,                                                                                                                        1, 0,  1, 1);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 1,  2, 1);
    box.attach(new Gtk.Label({use_markup: true, label: "<big><b>"+_("For All Applications on the List")+"</b></big>", halign: Gtk.Align.CENTER}),0, 2,  2, 1);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 3,  2, 1);
    this.prefCombo('for-list',4,['none','count','banner','both'], [_('Show them'),_('Show counts only'),_('Show banner only'),_('Ignore them')], box);
    this.prefSwitch("run-script", 5, box);
    box.attach(new Gtk.Label({label: ""}),                                                                                                       0, 6,  2, 1);
    box.attach(new Gtk.Label({use_markup: true, label: "<big><b>"+_("For Selected Application")+"</b></big>", halign: Gtk.Align.CENTER}),        0, 7,  2, 1);
    box.attach( this.iconImageBox,                                                                                                               0, 9,  2, 1);        
    box.attach(this.AppLabel,                                                                                                                    0, 10, 2, 1);
    box.attach(this.scriptLocation,                                                                                                              0, 11, 2, 1);
    box.attach(this.setButton,                                                                                                                   1, 12, 1, 1);
    box.attach(this.browseButton,                                                                                                                0, 12, 1, 1);  
    box.attach(this.clearButton,                                                                                                                 1, 12, 1, 1);          
    this.attach(box, 1, 0, 1, 1);
    this.treeView.connect("cursor-changed",() => this.appViewChange());
  }

  setNotificationBannerPolicy(caninicalizedNameWithPath, value) {
    switch(value) {
      case 0:
      case 2: 
        new Gio.Settings({ schema_id: "org.gnome.desktop.notifications.application", path: caninicalizedNameWithPath }).set_boolean("show-banners", true);
        break;
      default:
        new Gio.Settings({ schema_id: "org.gnome.desktop.notifications.application", path: caninicalizedNameWithPath }).set_boolean("show-banners", false);
    }
  }
});

const PrefsWindowForCalendar_NotificationCenterExtensionClass = GObject.registerClass(
class PrefsWindowForCalendar_NotificationCenterExtension extends PrefsWindow_NotificationCenterExtensionClass {
  constructor() {
    super();
  }
  
  displayPrefs() {
    let pos = 0;
    this.prefCombo ("events-position",                      pos++, ["dontshow", "below", "beside"],  [_("Only In Notification Center")+"  ", _("Below Calendar"), _("Beside Calendar")]);
    this.prefSwitch("autohide-space-beside-calendar",       pos++);                                                      
    this.prefSwitch("calendar-on-left",                     pos++);
    this.prefSwitchInverted("show-events-section-if-empty", pos++);
    this.prefSwitch("hide-clock-section",                   pos++);
    this.prefSwitch("hide-weather-section",                 pos++);
    this.prefSwitch("hide-date-section",                    pos);
  }

  prefSwitchInverted(KEY, pos) {
    let SettingSwitch = new Gtk.Switch({hexpand: false, active: !settings.get_boolean(KEY), halign: Gtk.Align.END});
    SettingSwitch.connect("notify::active", (button) => {
      settings.set_boolean(KEY, !button.active);
      reloadExtension();
    });
    this.attachLabel(KEY,pos);
    this.attach(SettingSwitch, 1, pos, 1, 1);
  }
});

const PrefsWindowForIndicator_NotificationCenterExtensionClass = GObject.registerClass(
class PrefsWindowForIndicator_NotificationCenterExtension extends PrefsWindow_NotificationCenterExtensionClass {
  constructor() {
    super();
  }
  
  displayPrefs() {
    let pos = 0;
    this.prefCombo   ("indicator-pos",           pos++, ['left','center','right'],                 [_('Left'), _('Center'), _('Right')]                );
    this.prefInt     ("indicator-index",         pos++,    0,   20,       1                                                                            );
    this.prefSwitch  ("individual-icons",        pos++                                                                                                 );
    this.prefSwitch  ("change-icons",            pos++                                                                                                 );
    this.prefComboInt("autohide",                pos++, ['0','1','2'],                             [_("No"),_("Yes"),_("If Do Not Disturb is Off")]    );
    this.prefCombo   ("new-notification",        pos++, ['none', 'dot', 'count'],                  [_('Show Nothing'), _('Show Dot'), _('Show Count')] );
    this.prefSwitch  ("include-events-count",    pos++                                                                                                 );
    this.prefTime    ("blink-icon",              pos++,    0,     10000,       1                                                                       );
    this.prefTime    ("blink-time",              pos++,    100,   10000,       10                                                                      );
    this.prefSwitch  ("animate-icon",            pos++                                                                                                 );
    this.prefSwitch  ("show-label",              pos++                                                                                                 );
    this.prefSwitch  ("middle-click-dnd",        pos                                                                                                   );
  }

  prefComboInt(KEY, pos, options, items) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(settings.get_int(KEY));
    SettingCombo.connect('changed', (widget) => {
      settings.set_int(KEY, widget.get_active());
      reloadExtension();
    });
    this.attachLabel(KEY,pos);
    this.attach(SettingCombo, 1, pos, 1, 1);
  }
  
  prefInt(KEY,pos) {
    let timeSetting = Gtk.SpinButton.new_with_range(0, 20, 1);
    timeSetting.set_value(settings.get_int(KEY));
    timeSetting.connect('notify::value', (spin) => {
      settings.set_int(KEY, spin.get_value_as_int());
      reloadExtension();
    });
    this.attachLabel(KEY,pos);
    this.attach(timeSetting, 1, pos, 1, 1);
  }
});

const PrefsWindowForNotifications_NotificationCenterExtensionClass = GObject.registerClass(
class PrefsWindowForNotifications_NotificationCenterExtension extends PrefsWindow_NotificationCenterExtensionClass {
  constructor() {
    super();
    this.orderSectionsReOrderRunning = false;
  }

  adjustOtherSectionsKeepingThisKeyValueSame(KEY) {
    let currentKeyValue = settings.get_int(KEY);
    let currentSection = KEY.substring(5,KEY.length); 
    
    if(currentKeyValue === 0) return;
  
    let mediaNotificationEventsSectionOrder = [ settings.get_int("show-media"), settings.get_int("show-notification"), settings.get_int("show-events") ];
    
    let missingValue;
    for(missingValue=1;missingValue<=3;missingValue++){
      if(mediaNotificationEventsSectionOrder.indexOf(missingValue)===-1){
        break;
      }
    }
    
    if(currentKeyValue === mediaNotificationEventsSectionOrder[0] && currentSection!=="media"){
      settings.set_int("show-media",missingValue);
    }
    if(currentKeyValue === mediaNotificationEventsSectionOrder[1] && currentSection!=="notification"){
      settings.set_int("show-notification",missingValue);
    }
    if(currentKeyValue === mediaNotificationEventsSectionOrder[2] && currentSection!=="events"){
      settings.set_int("show-events",missingValue);
    }
  }
  
  displayPrefs() {
    let pos = 0;
    this.prefSectionPosition ("show-media",           pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefSectionPosition ("show-notification",    pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefSectionPosition ("show-events",          pos++, ["none","top","middle","bottom"], [_("Don't Show"), _('At The Top'),_('In The Middle'), _('At The Bottom')]);
    this.prefCombo ("dnd-position",                   pos++, ["none","top","bottom"],          [_("Don't Show"), _('On Top'), _('At Bottom')]                           );
    this.prefCombo ("clear-button-alignment",         pos++, ['left','center','right','hide'], [_('Left'), _('Center'), _('Right'), _("Don't Show")]                    );
    this.prefSwitch("autoclose-menu",                 pos++                                                                                                             );
    this.prefStr   ("indicator-shortcut",             pos++, ['<Alt>', '<Ctrl>', '<Shift>', '<Super>'], [_('Alt Key'), _('Ctrl Key'), _('Shift Key'), _('Super Key')]   );
    this.prefTime  ("max-height",                     pos++, 20,  100, 1                                                                                                );
    this.prefCombo ("banner-pos",                     pos, ["11","12","13","21","22","23","31","32","33"], [_('Top Left'), _('Top Center'), _('Top Right'), _('Middle Left'), _('Middle Center'), _('Middle Right'), _('Bottom Left'), _('Bottom Center'), _('Bottom Right')]);  
  }
  
  prefSectionPosition(KEY, pos, options, items) {
    let SettingCombo = new Gtk.ComboBoxText();
    for (let i = 0; i < options.length; i++) {
      SettingCombo.append(options[i],  items[i]);
    }
    SettingCombo.set_active(settings.get_int(KEY));
    SettingCombo.connect('changed', (widget) => {
      settings.set_int(KEY,widget.get_active());
      this.adjustOtherSectionsKeepingThisKeyValueSame(KEY);
      this.reorderOrderOfSections();
      reloadExtension();
    });
    
    settings.connect("changed::"+KEY, () => { SettingCombo.set_active(settings.get_int(KEY)); })
    
    this.attachLabel(KEY,pos);
    this.attach(SettingCombo, 1, pos, 1, 1);
  }
 
  reorderOrderOfSections() {
    let orderStr = ["noValue","noValue","noValue"];
    let mediaNotificationEventsSectionOrder = [ settings.get_int("show-media"), settings.get_int("show-notification"), settings.get_int("show-events") ];
    
    if(mediaNotificationEventsSectionOrder[0]!==0){
      orderStr[mediaNotificationEventsSectionOrder[0]-1] = "media";
    }
    if(mediaNotificationEventsSectionOrder[1]!==0){
      orderStr[mediaNotificationEventsSectionOrder[1]-1] = "notification";
    }
    if(mediaNotificationEventsSectionOrder[2]!==0){
      orderStr[mediaNotificationEventsSectionOrder[2]-1] = "events";
    }
    
    let tempOrderStr=[];
    for(let i=0;i<3;i++) {
      if(orderStr[i]!=="noValue"){
        tempOrderStr.push(orderStr[i]);
      }
    }
   
    settings.set_strv("sections-order",tempOrderStr);
  }
});

const Prefs_NotificationCenterExtensionClass = GObject.registerClass(
class Prefs_NotificationCenterExtension extends Gtk.Stack {
  constructor() {
    super({ transition_type: 6, transition_duration: 200 });

    this.notificationPrefs = new PrefsWindowForNotifications_NotificationCenterExtensionClass();
    this.calendarPrefs     = new PrefsWindowForCalendar_NotificationCenterExtensionClass();
    this.indicatorPrefs    = new PrefsWindowForIndicator_NotificationCenterExtensionClass();
    this.appListPrefs      = new PrefsWindowForAppList_NotificationCenterExtensionClass();

    this.add_titled(this.notificationPrefs, "Notifications", _("Notifications"));
    this.add_titled(this.calendarPrefs, "Calendar", _("Calendar"));
    this.add_titled(this.indicatorPrefs, "Indicator", _("Indicator"));
    this.add_titled(this.appListPrefs, "Profiles", _("Profiles"));
    
    this.notificationPrefs.displayPrefs();
    this.calendarPrefs.displayPrefs();
    this.indicatorPrefs.displayPrefs();
    this.appListPrefs.displayPrefs();
  }
});

export default class NotificationCenterPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        settings = this.getSettings();
        window.set_default_size(800, 700);
        
        let prefsWidget = new Prefs_NotificationCenterExtensionClass();
        
        let stackSwitcher = new Gtk.StackSwitcher({ halign: Gtk.Align.CENTER, stack: prefsWidget });
        
        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 20, margin_top: 20, margin_bottom: 20, margin_start: 20, margin_end: 20 });
        vbox.append(stackSwitcher);
        vbox.append(prefsWidget);

        // Put it in the Adwaita PreferencesPage to satisfy GNOME 42+ preference standards
        // Note: the wrapper could be implemented using standard modern Adw classes if fully refactored,
        // but this embeds the complex existing preferences stack into the required Adw.PreferencesWindow safely.
        let page = new Adw.PreferencesPage();
        let group = new Adw.PreferencesGroup();
        group.add(vbox);
        page.add(group);
        window.add(page);
    }
}

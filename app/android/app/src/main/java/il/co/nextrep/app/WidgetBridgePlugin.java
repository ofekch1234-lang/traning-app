package il.co.nextrep.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the widget snapshot (JSON) from the web app, stores it and refreshes the home-screen widget. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    static final String PREFS = "nr_widget";
    static final String KEY = "snap";

    @PluginMethod
    public void set(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json missing"); return; }
        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        NextRepWidget.updateAll(ctx);
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }
}

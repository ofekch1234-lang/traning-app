package il.co.nextrep.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Small home-screen widget: today's steps against the goal. Data comes from WidgetBridgePlugin (last sync from Health Connect). */
public class NextRepStepsWidget extends AppWidgetProvider {

    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, NextRepStepsWidget.class));
        for (int id : ids) m.updateAppWidget(id, build(ctx));
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(ctx));
    }

    private static String num(int n) { return NumberFormat.getIntegerInstance(Locale.US).format(n); }

    static RemoteViews build(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_steps);
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.ws_root, PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        JSONObject s = null, L = null;
        try {
            String raw = ctx.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE).getString(WidgetBridgePlugin.KEY, null);
            if (raw != null) { s = new JSONObject(raw); L = s.optJSONObject("L"); }
        } catch (Exception ignored) { }
        if (L == null) L = new JSONObject();
        v.setTextViewText(R.id.ws_lbl, L.optString("steps", "צעדים"));
        if (s == null || !s.optBoolean("stOn", false)) {
            v.setTextViewText(R.id.ws_steps, "—");
            v.setTextViewText(R.id.ws_of, L.optString("connect", "חבר צעדים באפליקציה"));
            v.setTextViewText(R.id.ws_pct, "");
            v.setTextViewText(R.id.ws_meta, "");
            v.setProgressBar(R.id.ws_bar, 100, 0, false);
            return v;
        }
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean same = today.equals(s.optString("day"));
        int st = same ? s.optInt("st", 0) : 0, stG = Math.max(1, s.optInt("stG", 8000));
        int pct = Math.min(100, Math.round(st * 100f / stG));
        v.setTextViewText(R.id.ws_steps, num(st));
        v.setTextViewText(R.id.ws_of, L.optString("of", "מתוך") + " " + num(stG));
        v.setTextViewText(R.id.ws_pct, pct + "%");
        v.setProgressBar(R.id.ws_bar, 100, pct, false);
        double km = same ? s.optDouble("stKm", 0) : 0;
        int kc = same ? s.optInt("stKc", 0) : 0;
        v.setTextViewText(R.id.ws_meta, String.format(Locale.US, "%.1f", km) + " " + L.optString("km", "ק״מ") + " · " + num(kc) + " " + L.optString("kc", "קל׳"));
        return v;
    }
}

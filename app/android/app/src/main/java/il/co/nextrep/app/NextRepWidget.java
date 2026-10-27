package il.co.nextrep.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Home-screen widget: calories left today, protein, next workout and the week. Data comes from WidgetBridgePlugin. */
public class NextRepWidget extends AppWidgetProvider {

    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, NextRepWidget.class));
        for (int id : ids) m.updateAppWidget(id, build(ctx));
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(ctx));
    }

    private static String num(int n) { return NumberFormat.getIntegerInstance(Locale.US).format(n); }

    static RemoteViews build(Context ctx) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_nextrep);
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        JSONObject s = null, L = null;
        try {
            String raw = ctx.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE).getString(WidgetBridgePlugin.KEY, null);
            if (raw != null) { s = new JSONObject(raw); L = s.optJSONObject("L"); }
        } catch (Exception ignored) { }
        if (L == null) L = new JSONObject();
        if (s == null) {
            v.setTextViewText(R.id.w_kcal, "—");
            v.setTextViewText(R.id.w_kcal_lbl, L.optString("open", "פתח את NextRep"));
            v.setViewVisibility(R.id.w_right, View.GONE);
            return v;
        }
        v.setViewVisibility(R.id.w_right, View.VISIBLE);

        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean same = today.equals(s.optString("day"));
        int eaten = same ? s.optInt("kcal", 0) : 0;
        int target = same ? s.optInt("kT", 0) : s.optInt("kT2", s.optInt("kT", 0));
        int prot = same ? s.optInt("prot", 0) : 0;
        int pT = s.optInt("pT", 0);

        int accent;
        try { accent = Color.parseColor(s.optString("accent", "#BFFF2F")); } catch (Exception e) { accent = 0xFFBFFF2F; }
        boolean over = target > 0 && eaten > target;

        if (target > 0) {
            v.setTextViewText(R.id.w_kcal, num(over ? eaten - target : target - eaten));
            v.setTextViewText(R.id.w_kcal_lbl, over ? L.optString("over", "מעל היעד") : L.optString("left", "קק״ל נותרו"));
            v.setProgressBar(R.id.w_kcal_bar, 100, Math.min(100, Math.round(eaten * 100f / target)), false);
        } else {
            v.setTextViewText(R.id.w_kcal, num(eaten));
            v.setTextViewText(R.id.w_kcal_lbl, L.optString("kcal", "קק״ל"));
            v.setProgressBar(R.id.w_kcal_bar, 100, 0, false);
        }
        v.setTextViewText(R.id.w_prot_lbl, L.optString("protein", "חלבון"));
        v.setTextViewText(R.id.w_prot, pT > 0 ? prot + "/" + pT : String.valueOf(prot));
        v.setProgressBar(R.id.w_prot_bar, 100, pT > 0 ? Math.min(100, Math.round(prot * 100f / pT)) : 0, false);

        String sub = s.optString("nextSub", "");
        v.setTextViewText(R.id.w_next_sub, sub.isEmpty() ? L.optString("next", "האימון הבא") : sub);
        v.setTextColor(R.id.w_next_sub, accent);
        String next = s.isNull("next") ? "" : s.optString("next", "");
        v.setTextViewText(R.id.w_next, next.isEmpty() ? L.optString("noPlan", "אין אימון מתוכנן") : next);
        StringBuilder meta = new StringBuilder();
        int ex = s.optInt("nextEx", 0), wd = s.optInt("wkDone", 0), wp = s.optInt("wkPlan", 0);
        if (ex > 0) meta.append(ex).append(' ').append(L.optString("ex", "תרגילים"));
        if (wp > 0) { if (meta.length() > 0) meta.append(" · "); meta.append(wd).append('/').append(wp).append(' ').append(L.optString("week", "השבוע")); }
        v.setTextViewText(R.id.w_meta, meta.toString());

        // pink bars when the app colour is pink (two bars per meter; only one is shown — tinting from a widget isn't supported on older Android)
        boolean pink = Color.red(accent) > Color.green(accent);
        int kp = target > 0 ? Math.min(100, Math.round(eaten * 100f / target)) : 0;
        int pp = pT > 0 ? Math.min(100, Math.round(prot * 100f / pT)) : 0;
        v.setProgressBar(R.id.w_kcal_bar_f, 100, kp, false);
        v.setProgressBar(R.id.w_prot_bar_f, 100, pp, false);
        v.setViewVisibility(R.id.w_kcal_bar, pink ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_prot_bar, pink ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_kcal_bar_f, pink ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_prot_bar_f, pink ? View.VISIBLE : View.GONE);
        return v;
    }
}

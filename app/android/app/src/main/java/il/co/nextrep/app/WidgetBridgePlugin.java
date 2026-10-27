package il.co.nextrep.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Bridge from the web app to native pieces:
 *  set  - the home-screen widget snapshot (JSON)
 *  play - an in-app sound that ducks the music instead of stopping it, then gives the audio focus back
 *  live - the ongoing "workout in progress" notification (rest countdown, next set) on the lock screen
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    static final String PREFS = "nr_widget";
    static final String KEY = "snap";
    static final String LIVE_CH = "nr_live_v1";
    static final int LIVE_ID = 4343;

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

    private MediaPlayer player;
    private AudioFocusRequest focusReq;

    @PluginMethod
    public void play(PluginCall call) {
        Context ctx = getContext();
        String name = call.getString("name", "nr_bell");
        int res = ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName());
        JSObject r = new JSObject();
        if (res == 0) { r.put("ok", false); call.resolve(r); return; }
        try {
            releasePlayer();
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) {
                focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs).build();
                am.requestAudioFocus(focusReq);
            } else {
                am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            }
            player = MediaPlayer.create(ctx, res, attrs, am.generateAudioSessionId());
            if (player == null) { abandonFocus(); r.put("ok", false); call.resolve(r); return; }
            player.setOnCompletionListener(mp -> releasePlayer());
            player.start();
            r.put("ok", true);
        } catch (Exception e) {
            releasePlayer();
            r.put("ok", false);
        }
        call.resolve(r);
    }

    private void releasePlayer() {
        if (player != null) { try { player.release(); } catch (Exception ignored) {} player = null; }
        abandonFocus();
    }

    private void abandonFocus() {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) { if (focusReq != null) am.abandonAudioFocusRequest(focusReq); focusReq = null; }
        else am.abandonAudioFocus(null);
    }

    private PendingIntent link(String path, int code) {
        Context ctx = getContext();
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("il.co.nextrep.app://live/" + path), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void live(PluginCall call) {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        String op = call.getString("op", "update");
        JSObject r = new JSObject();
        if ("end".equals(op)) { nm.cancel(LIVE_ID); r.put("ok", true); call.resolve(r); return; }
        try {
            JSONObject s = new JSONObject(call.getString("state", "{}"));
            JSONObject a = new JSONObject(call.getString("attrs", "{}"));
            JSONObject L = a.optJSONObject("L");
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(LIVE_CH) == null) {
                NotificationChannel ch = new NotificationChannel(LIVE_CH, L != null ? L.optString("channel", "Workout in progress") : "Workout in progress", NotificationManager.IMPORTANCE_LOW);
                ch.setSound(null, null); ch.enableVibration(false); ch.setShowBadge(false);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
            String phase = s.optString("phase", "set");
            double restEnd = s.optDouble("restEnd", 0) * 1000;
            boolean resting = "rest".equals(phase) && restEnd > System.currentTimeMillis();
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, LIVE_CH) : new Notification.Builder(ctx);
            int icon = ctx.getResources().getIdentifier("ic_stat_nextrep", "drawable", ctx.getPackageName());
            b.setSmallIcon(icon != 0 ? icon : ctx.getApplicationInfo().icon)
             .setColor(0xFF5E8C00)
             .setOngoing(!"done".equals(phase))
             .setOnlyAlertOnce(true)
             .setShowWhen(true)
             .setVisibility(Notification.VISIBILITY_PUBLIC)
             .setCategory(resting ? Notification.CATEGORY_STOPWATCH : Notification.CATEGORY_PROGRESS)
             .setContentIntent(link("open", 1))
             .setSubText(a.optString("workout", ""));
            if (resting) {
                b.setContentTitle((L != null ? L.optString("rest", "Rest") : "Rest") + " · " + s.optString("line", ""))
                 .setContentText(s.optString("detail", ""))
                 .setWhen((long) restEnd).setUsesChronometer(true).setChronometerCountDown(true)
                 .addAction(new Notification.Action.Builder(null, L != null ? L.optString("add30", "+30s") : "+30s", link("add30", 2)).build())
                 .addAction(new Notification.Action.Builder(null, L != null ? L.optString("skipShort", "Skip") : "Skip", link("skip", 3)).build());
            } else {
                long started = (long) (a.optDouble("startedAt", System.currentTimeMillis() / 1000.0) * 1000);
                b.setContentTitle(s.optString("title", ""))
                 .setContentText(s.optString("line", ""))
                 .setWhen(started).setUsesChronometer(!"done".equals(phase));
                if (!"done".equals(phase)) b.setProgress(1000, (int) Math.round(Math.max(0, Math.min(1, s.optDouble("progress", 0))) * 1000), false);
                if ("done".equals(phase)) b.setTimeoutAfter(5 * 60 * 1000);
            }
            Bundle ex = new Bundle();
            ex.putBoolean("android.requestPromotedOngoing", true); // Android 16 "live update" chip in the status bar
            b.addExtras(ex);
            nm.notify(LIVE_ID, b.build());
            r.put("ok", true);
        } catch (Exception e) {
            r.put("ok", false);
            r.put("why", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }
}

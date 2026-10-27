package il.co.nextrep.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // plugins that live inside the app module (not npm packages) are registered before the bridge starts
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

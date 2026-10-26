import UIKit
import Capacitor

/// The app's web view controller. Registers plugins that live inside the app target (not npm packages).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}

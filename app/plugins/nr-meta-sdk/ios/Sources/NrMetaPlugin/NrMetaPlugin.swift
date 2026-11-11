import Foundation
import UIKit
import Capacitor
import FacebookCore

/// Starts the Meta SDK when the app launches, so ad campaigns can count installs and app opens.
/// Runs only when CI stamped FacebookAppID and FacebookClientToken into Info.plist; otherwise it does nothing.
/// No tracking prompt: on iOS, installs are attributed through Apple's SKAdNetwork (aggregated, anonymous).
@objc(NrMetaPlugin)
public class NrMetaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NrMetaPlugin"
    public let jsName = "NrMeta"
    public let pluginMethods: [CAPPluginMethod] = []

    override public func load() {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let id = info["FacebookAppID"] as? String, !id.isEmpty,
              let tok = info["FacebookClientToken"] as? String, !tok.isEmpty else { return }
        DispatchQueue.main.async {
            ApplicationDelegate.shared.application(UIApplication.shared, didFinishLaunchingWithOptions: nil)
            AppEvents.shared.activateApp()
        }
    }
}

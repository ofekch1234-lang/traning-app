import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // The app's sounds and the silent exercise demo videos play alongside the user's music instead of stopping it
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        startMetaSDK()
        return true
    }

    /// Meta SDK (install attribution for ad campaigns). The SDK ships inside the app through the social-login plugin, but its
    /// module is not visible from this target, so it is started through the Objective-C runtime. Runs only when CI stamped
    /// FacebookAppID and FacebookClientToken into Info.plist; does nothing if the SDK is absent. No tracking prompt:
    /// on iOS, installs are attributed through Apple's SKAdNetwork (aggregated, anonymous).
    private func startMetaSDK() {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let id = info["FacebookAppID"] as? String, !id.isEmpty,
              let tok = info["FacebookClientToken"] as? String, !tok.isEmpty else { return }
        func shared(_ name: String) -> NSObject? {
            guard let cls = NSClassFromString(name) else { return nil }
            let sel = NSSelectorFromString("sharedInstance")
            guard (cls as AnyObject).responds(to: sel) else { return nil }
            return (cls as AnyObject).perform(sel)?.takeUnretainedValue() as? NSObject
        }
        if let sdk = shared("FBSDKApplicationDelegate") {
            let start = NSSelectorFromString("initializeSDK")
            if sdk.responds(to: start) { _ = sdk.perform(start) }
        }
        if let events = shared("FBSDKAppEvents") {
            let activate = NSSelectorFromString("activateApp")
            if events.responds(to: activate) { _ = events.perform(activate) }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // remote notifications (APNs): hand the device token to Capacitor's PushNotifications plugin
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

import Foundation
import Capacitor
import Security
import WidgetKit
import AVFoundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Receives a small JSON snapshot from the web app (today's calories/protein, next workout, week progress, labels)
/// and stores it where the home-screen / lock-screen widget can read it, then asks iOS to refresh the widget.
/// Storage is a shared keychain item (keychain sharing needs no App ID capability, unlike App Groups).
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin, AVAudioPlayerDelegate {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "live", returnType: CAPPluginReturnPromise)
    ]
    private var player: AVAudioPlayer?

    /// An in-app sound (rest over, a new record) that ducks the music instead of stopping it:
    /// the music gets quieter for a moment and comes back by itself when the sound ends.
    @objc func play(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "nr_bell"
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "public")
                ?? Bundle.main.url(forResource: name, withExtension: "wav") else {
            call.resolve(["ok": false]); return
        }
        DispatchQueue.main.async {
            let s = AVAudioSession.sharedInstance()
            try? s.setCategory(.playback, mode: .default, options: [.duckOthers])
            try? s.setActive(true)
            self.player = try? AVAudioPlayer(contentsOf: url)
            self.player?.delegate = self
            let ok = self.player?.play() ?? false
            if !ok { self.release() }
            call.resolve(["ok": ok])
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { release() }

    private func release() {
        player = nil
        // give the audio back: other apps (music, podcasts) resume at full volume
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// The workout Live Activity (lock screen + Dynamic Island): op = start | update | end.
    @objc func live(_ call: CAPPluginCall) {
        let op = call.getString("op") ?? "update"
        guard #available(iOS 16.1, *) else { call.resolve(["ok": false, "why": "ios"]); return }
        #if canImport(ActivityKit)
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["ok": false, "why": "off"]); return }
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .secondsSince1970
        let state = (call.getString("state")?.data(using: .utf8)).flatMap { try? dec.decode(NRWorkoutAttributes.ContentState.self, from: $0) }
        let current = Activity<NRWorkoutAttributes>.activities
        Task {
            switch op {
            case "start":
                for a in current { await a.end(using: nil, dismissalPolicy: .immediate) }
                guard let st = state, let ad = call.getString("attrs")?.data(using: .utf8),
                      let attrs = try? dec.decode(NRWorkoutAttributes.self, from: ad) else { call.resolve(["ok": false, "why": "data"]); return }
                do { _ = try Activity.request(attributes: attrs, contentState: st, pushType: nil); call.resolve(["ok": true]) }
                catch { call.resolve(["ok": false, "why": error.localizedDescription]) }
            case "end":
                let after = call.getDouble("after") ?? 0
                for a in current { await a.end(using: state ?? a.contentState, dismissalPolicy: after > 0 ? .after(Date().addingTimeInterval(after)) : .immediate) }
                call.resolve(["ok": true])
            default:
                guard let st = state else { call.resolve(["ok": false, "why": "data"]); return }
                if current.isEmpty { call.resolve(["ok": false, "why": "none"]); return }
                for a in current { await a.update(using: st) }
                call.resolve(["ok": true])
            }
        }
        #else
        call.resolve(["ok": false, "why": "sdk"])
        #endif
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.reject("json missing")
            return
        }
        let ok = NRSharedStore.write(data)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["ok": ok])
    }
}

enum NRSharedStore {
    static let service = "il.co.nextrep.widget"
    static let account = "snapshot"

    static func write(_ data: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        var status = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            for (k, v) in attrs { add[k] = v }
            status = SecItemAdd(add as CFDictionary, nil)
        }
        return status == errSecSuccess
    }
}

#if canImport(ActivityKit)
/// The same definition lives in the widget extension (NextRepWidget.swift); the two must stay identical.
@available(iOS 16.1, *)
struct NRWorkoutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String          // "rest" | "set" | "done"
        var restStart: Date?
        var restEnd: Date?
        var title: String          // rest: "Rest" · set: exercise name · done: "Workout saved"
        var line: String           // rest: "Next · set 3" · set: "Set 3 of 3 · target 72.5 × 8"
        var detail: String         // rest: exercise + target · set: what comes after
        var progress: Double       // sets done / total
    }
    var workout: String
    var startedAt: Date
    var accent: String
    var rtl: Bool
    var L: [String: String]
}
#endif

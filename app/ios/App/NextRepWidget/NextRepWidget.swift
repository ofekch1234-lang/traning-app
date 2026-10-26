import WidgetKit
import SwiftUI
import Security

// MARK: - Data written by the app (WidgetBridgePlugin) into a shared keychain item

struct NRSnap: Codable {
    var day: String?        // yyyy-MM-dd (local) the numbers belong to
    var kcal: Int?          // eaten today
    var kT: Int?            // today's calorie target
    var kT2: Int?           // tomorrow's target (used after midnight until the app opens again)
    var prot: Int?
    var pT: Int?
    var next: String?       // next workout name
    var nextEx: Int?        // exercises in it
    var nextSub: String?    // e.g. "today's workout" / "up next"
    var wkDone: Int?
    var wkPlan: Int?
    var accent: String?     // hex, follows the app colour (lime / pink)
    var rtl: Bool?
    var L: [String: String]? // labels in the user's language
}

enum NRStore {
    static func read() -> NRSnap? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "il.co.nextrep.widget",
            kSecAttrAccount as String: "snapshot",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return try? JSONDecoder().decode(NRSnap.self, from: d)
    }
}

// MARK: - What a view needs, already adjusted for "a new day started since the app last wrote"

struct NRModel {
    var hasData: Bool
    var eaten: Int
    var target: Int
    var prot: Int
    var protT: Int
    var next: String?
    var nextEx: Int
    var nextSub: String
    var wkDone: Int
    var wkPlan: Int
    var accent: Color
    var rtl: Bool
    var L: [String: String]

    var left: Int { max(0, target - eaten) }
    var over: Bool { target > 0 && eaten > target }
    var kcalFrac: Double { target > 0 ? min(1, Double(eaten) / Double(target)) : 0 }
    var protFrac: Double { protT > 0 ? min(1, Double(prot) / Double(protT)) : 0 }
    func t(_ k: String, _ fallback: String) -> String { L[k] ?? fallback }

    static func load(at date: Date) -> NRModel {
        let s = NRStore.read()
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        let sameDay = s?.day == f.string(from: date)
        return NRModel(
            hasData: s != nil,
            eaten: sameDay ? (s?.kcal ?? 0) : 0,
            target: sameDay ? (s?.kT ?? 0) : (s?.kT2 ?? s?.kT ?? 0),
            prot: sameDay ? (s?.prot ?? 0) : 0,
            protT: s?.pT ?? 0,
            next: s?.next,
            nextEx: s?.nextEx ?? 0,
            nextSub: s?.nextSub ?? "",
            wkDone: s?.wkDone ?? 0,
            wkPlan: s?.wkPlan ?? 0,
            accent: Color(hex: s?.accent ?? "#BFFF2F"),
            rtl: s?.rtl ?? true,
            L: s?.L ?? [:]
        )
    }

    static let sample = NRModel(hasData: true, eaten: 1240, target: 2100, prot: 96, protT: 160, next: "פלג גוף עליון A",
                                nextEx: 6, nextSub: "האימון של היום", wkDone: 2, wkPlan: 4, accent: Color(hex: "#BFFF2F"), rtl: true, L: [:])
}

extension Color {
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: h).scanHexInt64(&v)
        if h.count != 6 { v = 0xBFFF2F }
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

func nrNum(_ n: Int) -> String {
    let f = NumberFormatter(); f.numberStyle = .decimal; f.locale = Locale(identifier: "en_US")
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
}

// MARK: - Timeline: refresh when the app writes, and at midnight so "eaten today" resets

struct NREntry: TimelineEntry {
    let date: Date
    let m: NRModel
}

struct NRProvider: TimelineProvider {
    func placeholder(in context: Context) -> NREntry { NREntry(date: Date(), m: .sample) }
    func getSnapshot(in context: Context, completion: @escaping (NREntry) -> Void) {
        let m = NRModel.load(at: Date())
        completion(NREntry(date: Date(), m: context.isPreview && !m.hasData ? .sample : m))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<NREntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86400))
        let entries = [NREntry(date: now, m: .load(at: now)), NREntry(date: midnight, m: .load(at: midnight))]
        completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(3600))))
    }
}

// MARK: - Views

let nrInk = Color(red: 0.95, green: 0.96, blue: 0.95)
let nrMuted = Color(red: 0.64, green: 0.68, blue: 0.65)
let nrBG = Color(red: 0.04, green: 0.043, blue: 0.04)
let nrTrack = Color.white.opacity(0.10)

extension View {
    @ViewBuilder func nrBackground(_ c: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(c, for: .widget)
        } else {
            self.background(c)
        }
    }
}

struct KcalRing: View {
    let m: NRModel
    var body: some View {
        ZStack {
            Circle().stroke(nrTrack, lineWidth: 9)
            Circle().trim(from: 0, to: m.kcalFrac)
                .stroke(m.over ? Color.orange : m.accent, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(m.target > 0 ? nrNum(m.over ? m.eaten - m.target : m.left) : nrNum(m.eaten))
                    .font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundColor(nrInk)
                    .minimumScaleFactor(0.6).lineLimit(1)
                Text(m.target > 0 ? (m.over ? m.t("over", "מעל היעד") : m.t("left", "קק״ל נותרו")) : m.t("kcal", "קק״ל"))
                    .font(.system(size: 9, weight: .semibold)).foregroundColor(nrMuted).lineLimit(1).minimumScaleFactor(0.7)
            }.padding(.horizontal, 8)
        }
        .frame(width: 92, height: 92)
    }
}

struct MediumView: View {
    let m: NRModel
    var body: some View {
        HStack(spacing: 14) {
            KcalRing(m: m)
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(m.t("protein", "חלבון")).font(.system(size: 11, weight: .semibold)).foregroundColor(nrMuted)
                        Spacer(minLength: 4)
                        Text(m.protT > 0 ? "\(m.prot)/\(m.protT)" : "\(m.prot)")
                            .font(.system(size: 11, weight: .bold, design: .rounded)).foregroundColor(nrInk)
                    }
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(nrTrack)
                            Capsule().fill(m.accent).frame(width: max(4, g.size.width * m.protFrac))
                        }
                    }.frame(height: 6)
                }
                Rectangle().fill(nrTrack).frame(height: 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.nextSub.isEmpty ? m.t("next", "האימון הבא") : m.nextSub)
                        .font(.system(size: 10, weight: .bold)).foregroundColor(m.accent).lineLimit(1)
                    Text(m.next ?? m.t("noPlan", "אין אימון מתוכנן"))
                        .font(.system(size: 15, weight: .heavy)).foregroundColor(nrInk).lineLimit(1).minimumScaleFactor(0.75)
                    HStack(spacing: 6) {
                        if m.nextEx > 0 {
                            Text("\(m.nextEx) \(m.t("ex", "תרגילים"))").font(.system(size: 10, weight: .medium)).foregroundColor(nrMuted)
                        }
                        if m.wkPlan > 0 {
                            Text("· \(m.wkDone)/\(m.wkPlan) \(m.t("week", "השבוע"))").font(.system(size: 10, weight: .medium)).foregroundColor(nrMuted)
                        }
                    }.lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .environment(\.layoutDirection, m.rtl ? .rightToLeft : .leftToRight)
        .nrBackground(nrBG)
    }
}

struct RectView: View {
    let m: NRModel
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(m.target > 0 ? "\(nrNum(m.over ? m.eaten - m.target : m.left)) \(m.over ? m.t("over", "מעל היעד") : m.t("left", "קק״ל נותרו"))" : "\(nrNum(m.eaten)) \(m.t("kcal", "קק״ל"))")
                .font(.system(size: 15, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
            Text("\(m.t("protein", "חלבון")) \(m.prot)\(m.protT > 0 ? "/\(m.protT)" : "")")
                .font(.system(size: 12, weight: .semibold)).lineLimit(1)
            if let n = m.next {
                Text(n).font(.system(size: 12, weight: .regular)).lineLimit(1).opacity(0.85)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .environment(\.layoutDirection, m.rtl ? .rightToLeft : .leftToRight)
        .nrBackground(Color.clear)
    }
}

@available(iOSApplicationExtension 16.0, *)
struct CircView: View {
    let m: NRModel
    var body: some View {
        Gauge(value: m.kcalFrac) {
            Text("kcal")
        } currentValueLabel: {
            Text(m.target > 0 ? nrNum(m.left) : nrNum(m.eaten)).font(.system(size: 13, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .nrBackground(Color.clear)
    }
}

struct NRWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: NREntry
    var body: some View {
        switch family {
        case .accessoryRectangular:
            RectView(m: entry.m)
        case .accessoryCircular:
            if #available(iOSApplicationExtension 16.0, *) { CircView(m: entry.m) } else { RectView(m: entry.m) }
        default:
            MediumView(m: entry.m)
        }
    }
}

@main
struct NextRepWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextRepToday", provider: NRProvider()) { entry in
            NRWidgetView(entry: entry)
        }
        .configurationDisplayName("NextRep")
        .description("קלוריות, חלבון והאימון הבא שלך")
        .supportedFamilies([.systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

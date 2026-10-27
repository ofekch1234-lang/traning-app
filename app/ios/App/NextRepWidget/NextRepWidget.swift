import WidgetKit
import SwiftUI
import Security
import ActivityKit

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

// MARK: - Workout Live Activity (lock screen + Dynamic Island) while a workout is running

/// Must stay identical to the definition in the app target (WidgetBridgePlugin.swift).

// The app icon, embedded so the widget extension needs no asset catalog (lime, or pink for the women's theme).
private let nrIconM = "iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAIAAADajyQQAAAJLklEQVR42u2ae4hc9RXHv+f87p2ZvbOzs7uTTYxJbKIQtO1iIGiitGikpaG1KgXBVAyohD4Rk9bEVCEES9fdpLZIKy0WhdialYBIYkGl+ChifGArbWqroMaap7uzz5m7c+fe3zn9Yze7M7Mzs6/EFJnLsn8MzP39Puec3/c8fkMv6eX4PD6Mz+nTAGuANcAaYA2wBlgDrAHWAGuANcAaYP/nj3N2XqMQBbT8QwLP126qIDrfYCJghkdMgAKl/8dUQKA5IqnCYcj59ZgoPOaCyrtHxgJfp8ysYAdfXNtkVQWzNb+1GjfsEA2MRskU6/kCE4HH/I83/Yd+cPrjd4siU9FIjCDQW37atm3PkpwV5RnYRECEVuP0D0aP7Pw02WK29SwZtpEx9FmLhypiRCePh/fdeOK9vwVujGJxiiUm/tw4pdLcu3fgoXtONxuGQLXme6zVJHOM6OnHB7esO3rw9wM2UsK0Q/vZeEysNjnmL0+N9J8KWzNOGGiFnCihpdXp3TsAwrae6n5TwCVKGPP24fyj9/e//WLe8wwbs0DlmA+YCFSUeWLl/mMREcRWl0obaUur07tngICt09hUYYDsyWjfL7LP/mE4CrSl1SGG70/ZSAUiSkxzFVieK1UTU9pxYkwiAEBUM8Ym9CDSllZn/56BX+34tCImxWozmQO/GXz6t9lEEyfTbCNVKVsuxpR2nKYzy50TMFV4zO8dKRzsHTzxSejFWGocAioPuQm2nux0NgWIwIaBSrcL4MX4xLHw0FND/zlS8JhVz0EoikXS8DOPDf3y+6fDUFsXmd0HLrzu2tT0ICRCMKbGwI1NmXmSDcDW7sXjMVn68unLNYEOv+zvuvnEcL91XPrJ75bcdEdr3gqbs+QxFajAGOQC+8eurAraO5yh/mh/zwBX81VQ0Cu+key4yBnLa+km6vit1s729wwM9UdtHY4K/tSVzQXWmIn9LAhMAVXEmQwThHxfowBuDFGoDpM/KkUolb+AmcJQOr/atOeZ5V6axl1Xi42IaqERowj1R8VhikJ1YwgD+L5CyDDFmVRnyAVch8oAMaIP3w+GspHHVCoVqiCuWSuN9Ns1l3ndf17utXBhrLrffn3vpy7qpSoCiEuWIwDwmIay0YfvBzEiUzfPcS0sUkiABzaf3HL5x3d2Hn31hZzXTNZqGXqNx7gYErtmvdf97DKvhYPpbG3Ok93Zl5/JNcNIVDdmSqotr5lefSF3Z+fRLZd//MDmkxKAtOY2uJasJ4nffDH//BPDsQT3n7SP786GRZ004cyixDRatOvXNT9YjQ0KYsoPC81akIkRFvXx3dn+kzaW4OefGH7zpXySuFYa4BovUgKG+y0xESPmUsGXsfxUXp5cr/rXLTzw64fyzz03vGFdqutQFTYVsDMDTMXpHctrwZeYS8QgpuE+S4DW2EQ98WADFUChAmY4bqWsOzUqH1U4wFBftPvm46+8lbtm/RSbMZhNMANwiCpe77hgLtmSmbfca1li8UdlyjoEGyHv21pOEyCRZD+nO799/JXXRyfY0lyoYKvtrrxvbQSU1F/+qJRlPF1gHlPEEnTqo/Cuqz7JDVrHJRtp3OMP3gk2X32071joMKto1ZxORP6I/dkNx//6xug161NdByfY6hhbRR3mvmPh5quPfvBOEPfYRuq4lBu0d131yamPwliCZnPOz+3MQxVxj/PDcm+53wJfFl6/LxSMCMWCXrDKffjwiuY2E4VqHAp8uWRNfN9rKzuWu5EIMdWpxRJN5A/LREyuS3UdXOa1sGp1vxFTJNKx3N332spL1sQDX4xDUajNbebhwysuWOUWCzobo9QFozIh8VJc2vkbB0lvVo2THWcbkZLzttxrpkJeuLY1k54xTklLTvBSXGYLmi+YWBADBGKIIAorwyyqH+xUxhYvZbuiedeBZa0dTlR7HBJppZJHIURKtmTnXt2PV3HpDqOiKiiGmkhyU5KkXCRmGGNEoPISfpLtwWeXbdyYPl0MfQiZmk4rrxm0KUmJJBdDTQhUNN1hFKAam+BaGSyvcuWG5Mbb0kFBMkvN7bsyboxUZjtvUiCZZhUt9dsk273XH3/9jVwqZiKZVSFDBBW4Mbp9Vyaz1AQF2Xhb+soNybzW7GJqJn8lmDjdt2/prfe3t2TM0ox7arB8ZlSbkB3kYK+9qfm7OzJPdmdbWh0baQXbjuuPdx1atmF9yoazCmZjyM/pV77e/Ng/V45k7crVcQEslOZ6xgiw0FD14tXx1ozji5ZW2eMmrH/CQuDuBxdv2p4ZGYqMQ5U6OSI7vnXsnX/7LYtMzaZJSpZTAPBFWzPOxavjoWodqhk6aAJACEQBMMPzyI0jLKKpmSJRr4VjoFo933gVl7OytXsxoPt7Bkr9NqElw3rPTccuWh13Xa44vSqIgbwUR6KOS/4o3Dh5HoHVCixAvPA8xiCGtUjFza0728EY6IvSGWfT9naZ6WCAkbOytXvJpu3t0/3WlKS+/0ZvPZ+PJ6oYSIBN29vTGWewLwLh1p3tqbixdmI/Z23mMS4nN97RuvqKxEf/Cr58tbfsIncMVc5u6SdE0DNsAO3vKT9vAsclxKq0+mwwBl17rffo379w5PDYystil3Um6kjFguaKRPBFL+1MdHZ6AcQvSiLmTEcSK1qihSVsVWJS63aKflEuXOGuWhEPIb7onEaLcxuYMmNM1JeIyyeYxDAO5YasE6fv/Chz84/bcmr5jISW+k0VvXvK2KqLu04sVxQtSDSPgemcJ8HMwHhlKJOOorCgvm/XXpfc8vNFa69KFiBhuWRNsm3rWQKcYbNVJjJsoIpFy50pk/F86uWFXiOpQqzNLHPv3rn4m7enHdCwjZir1ANlbIrevQOptKkIRSIMZe2ipe7XbmkZU2Ez/xZgAWAEBYxDN3yv/Yddixe1OSNqA9U6Fz9TbHuWAOjdOxiPl+ghgRmXrk1se2Tx0gtdX4QX0FTRQn4TTEB+VNpTTgQNrMzyLksVDBiid98ek6isvIh7tOpL8QSxr8ILa9hogT92ZiASEM3tylgBKJqm3e4KNICO3/1+1tdIlb2WzmcT4zWNL1LlPp7OAtVZAFtIh8/nci7R+AFLA6wB1gBrgDXAGmANsAZYA6wB1gBrgJ2f53+dv+IahMgYLgAAAABJRU5ErkJggg=="
private let nrIconF = "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"
struct NRLogo: View {
    let accent: String
    let size: CGFloat
    var body: some View {
        let fem = accent.lowercased().contains("ff6fa3") || accent.lowercased().contains("ff4fa3")
        if let data = Data(base64Encoded: fem ? nrIconF : nrIconM), let img = UIImage(data: data) {
            Image(uiImage: img).resizable().interpolation(.high).frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
        } else {
            Text("N").font(.system(size: size * 0.6, weight: .black)).frame(width: size, height: size)
        }
    }
}
struct NRWorkoutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String          // "rest" | "set" | "done"
        var restStart: Date?
        var restEnd: Date?
        var title: String
        var line: String
        var detail: String
        var progress: Double
    }
    var workout: String
    var startedAt: Date
    var accent: String
    var rtl: Bool
    var L: [String: String]
}

private func nrLink(_ path: String) -> URL { URL(string: "il.co.nextrep.app://live/\(path)")! }

struct NRLivePill: View {
    let text: String
    let filled: Bool
    let acc: Color
    var body: some View {
        Text(text).font(.system(size: 14, weight: .bold))
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(filled ? acc : Color.white.opacity(0.12))
            .foregroundColor(filled ? Color.black : nrInk)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct NRRestTimer: View {
    let s: NRWorkoutAttributes.ContentState
    let size: CGFloat
    let acc: Color
    var body: some View {
        if let e = s.restEnd {
            let st = min(s.restStart ?? e, e)
            Text(timerInterval: st...e, countsDown: true)
                .font(.system(size: size, weight: .heavy, design: .rounded)).monospacedDigit()
                .foregroundColor(acc).environment(\.layoutDirection, .leftToRight)
        }
    }
}

struct NRLiveLock: View {
    let a: NRWorkoutAttributes
    let s: NRWorkoutAttributes.ContentState
    var body: some View {
        let acc = Color(hex: a.accent)
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                NRLogo(accent: a.accent, size: 18)
                Text("NextRep · \(a.workout)").font(.system(size: 12, weight: .semibold)).foregroundColor(nrMuted).lineLimit(1)
                Spacer()
                if s.phase != "done" {
                    Text(a.startedAt, style: .timer).font(.system(size: 12, weight: .semibold)).monospacedDigit()
                        .foregroundColor(nrMuted).environment(\.layoutDirection, .leftToRight)
                }
            }
            if s.phase == "rest", let e = s.restEnd {
                HStack(alignment: .bottom, spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(a.L["rest"] ?? "מנוחה").font(.system(size: 12)).foregroundColor(nrMuted)
                        NRRestTimer(s: s, size: 38, acc: acc)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(s.line).font(.system(size: 12)).foregroundColor(nrMuted).lineLimit(1)
                        Text(s.detail).font(.system(size: 16, weight: .bold)).foregroundColor(nrInk).lineLimit(2).multilineTextAlignment(.trailing)
                    }
                }
                ProgressView(timerInterval: min(s.restStart ?? e, e)...e, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                    .tint(acc)
                HStack(spacing: 8) {
                    Link(destination: nrLink("add30")) { NRLivePill(text: a.L["add30"] ?? "+30 שנ׳", filled: false, acc: acc) }
                    Link(destination: nrLink("skip")) { NRLivePill(text: a.L["skip"] ?? "דלג על המנוחה", filled: true, acc: acc) }
                }
            } else {
                Text(s.title).font(.system(size: 19, weight: .heavy)).foregroundColor(s.phase == "done" ? acc : nrInk).lineLimit(1)
                Text(s.line).font(.system(size: 13)).foregroundColor(nrMuted).lineLimit(1)
                if !s.detail.isEmpty { Text(s.detail).font(.system(size: 13)).foregroundColor(nrMuted).lineLimit(1) }
                if s.phase != "done" { ProgressView(value: min(1, max(0, s.progress))).tint(acc) }
            }
        }
        .padding(16)
        .environment(\.layoutDirection, a.rtl ? .rightToLeft : .leftToRight)
        .widgetURL(nrLink("open"))
    }
}

struct NRWorkoutLive: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NRWorkoutAttributes.self) { ctx in
            NRLiveLock(a: ctx.attributes, s: ctx.state)
                .activityBackgroundTint(nrBG.opacity(0.92))
                .activitySystemActionForegroundColor(Color(hex: ctx.attributes.accent))
        } dynamicIsland: { ctx in
            let a = ctx.attributes, s = ctx.state, acc = Color(hex: a.accent)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if s.phase == "rest" {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(a.L["rest"] ?? "מנוחה").font(.system(size: 12)).foregroundColor(nrMuted)
                            NRRestTimer(s: s, size: 30, acc: acc)
                        }
                    } else {
                        Text(s.title).font(.system(size: 16, weight: .heavy)).foregroundColor(nrInk).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(s.line).font(.system(size: 12)).foregroundColor(nrMuted).lineLimit(1)
                        if s.phase == "rest" { Text(s.detail).font(.system(size: 14, weight: .bold)).foregroundColor(nrInk).lineLimit(2) }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if s.phase == "rest" {
                        HStack(spacing: 8) {
                            Link(destination: nrLink("add30")) { NRLivePill(text: a.L["add30"] ?? "+30 שנ׳", filled: false, acc: acc) }
                            Link(destination: nrLink("skip")) { NRLivePill(text: a.L["skipShort"] ?? "דלג", filled: true, acc: acc) }
                        }
                    } else if s.phase != "done" {
                        ProgressView(value: min(1, max(0, s.progress))).tint(acc)
                    }
                }
            } compactLeading: {
                NRLogo(accent: a.accent, size: 24)
            } compactTrailing: {
                if s.phase == "rest" { NRRestTimer(s: s, size: 15, acc: acc).frame(maxWidth: 52) }
                else if s.phase == "done" { Text("✓").foregroundColor(acc) }
                else { Text(a.startedAt, style: .timer).font(.system(size: 14, weight: .semibold)).monospacedDigit().foregroundColor(acc).frame(maxWidth: 52) }
            } minimal: {
                if s.phase == "rest" { NRRestTimer(s: s, size: 12, acc: acc) }
                else { NRLogo(accent: a.accent, size: 20) }
            }
            .widgetURL(nrLink("open"))
            .keylineTint(acc)
        }
    }
}

@main
struct NextRepWidgets: WidgetBundle {
    var body: some Widget {
        NextRepWidget()
        NRWorkoutLive()
    }
}

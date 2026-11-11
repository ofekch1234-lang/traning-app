// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NrMetaSdk",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "NrMetaSdk", targets: ["NrMetaPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        // same major as @capgo/capacitor-social-login, so SPM resolves one copy of the SDK
        .package(url: "https://github.com/facebook/facebook-ios-sdk.git", .upToNextMajor(from: "18.0.3"))
    ],
    targets: [
        .target(
            name: "NrMetaPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "FacebookCore", package: "facebook-ios-sdk")
            ],
            path: "ios/Sources/NrMetaPlugin")
    ]
)

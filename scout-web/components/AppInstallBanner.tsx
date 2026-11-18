"use client";

import { useEffect, useState } from "react";

const APK_DOWNLOAD_URL =
    "https://github.com/iamtjbest/scout-mobile/releases/download/v1.0.0/scout-by-tactica.apk";

export default function AppInstallBanner() {
    const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        if (isStandalone || sessionStorage.getItem("scout_install_dismissed")) return;

        const ua = navigator.userAgent.toLowerCase();
        if (/android/.test(ua)) setPlatform("android");
        else if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    }, []);

    if (!platform || dismissed) return null;

    const handleDismiss = () => {
        sessionStorage.setItem("scout_install_dismissed", "1");
        setDismissed(true);
    };

    return (
        <>
            <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-screen-md rounded-2xl border border-[#24313D] bg-[#131B22]/95 p-3.5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#c8ff00]">
                            Scout by Tactica
                        </p>
                        <p className="text-xs font-semibold text-white">
                            {platform === "android"
                                ? "Download the Android app for instant KWASU live scores"
                                : "Add Scout to your iPhone Home Screen"}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {platform === "android" ? (
                            <a
                                href={APK_DOWNLOAD_URL}
                                download
                                className="rounded-xl bg-[#c8ff00] px-3.5 py-2 text-xs font-extrabold text-[#0d1117] transition hover:opacity-90"
                            >
                                Get App
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowIosGuide(true)}
                                className="rounded-xl bg-[#00E5FF] px-3.5 py-2 text-xs font-extrabold text-[#0d1117] transition hover:opacity-90"
                            >
                                Install
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDismiss}
                            aria-label="Dismiss"
                            className="px-1.5 text-sm text-[#8A9BA8] hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            {showIosGuide && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[#24313D] bg-[#131B22] p-5 text-white">
                        <h3 className="text-base font-extrabold text-[#00E5FF]">
                            Install Scout on iPhone
                        </h3>
                        <ol className="mt-3 space-y-2.5 text-sm text-[#CBD5E1]">
                            <li>
                                1. Tap the <strong>Share</strong> button at the bottom of Safari.
                            </li>
                            <li>
                                2. Scroll down and tap <strong>Add to Home Screen</strong>.
                            </li>
                            <li>
                                3. Tap <strong>Add</strong> — Scout opens full-screen like a native app.
                            </li>
                        </ol>
                        <button
                            type="button"
                            onClick={() => setShowIosGuide(false)}
                            className="mt-4 w-full rounded-xl bg-[#c8ff00] py-2.5 text-xs font-extrabold text-[#0d1117]"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
package com.niakofa.wfm;

import android.net.Uri;

/**
 * Shares the browser's verified HTTPS identity and rendering context.
 * No WebView bridge, credentials, alternate token or native reward path.
 */
public final class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected Uri getLaunchingUrl() {
        // Never navigate to untrusted URL data supplied to this exported activity.
        // Sign-in/navigation inside the browser remains owned by the web app.
        return Uri.parse(LaunchTarget.requireStaging(BuildConfig.GAME_URL));
    }
}

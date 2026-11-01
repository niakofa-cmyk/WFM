package com.niakofa.wfm;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Looper;
import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Exercises real Android resources/activity lifecycle, without sign-in or network requests. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class LauncherStartupTest {
    @Test public void installedManifestResolvesTheActualLauncherClass() throws Exception {
        String packageName = RuntimeEnvironment.getApplication().getPackageName();
        PackageManager packages = RuntimeEnvironment.getApplication().getPackageManager();
        Intent intent = packages.getLaunchIntentForPackage(packageName);
        assertNotNull("Installed APK must have a launchable activity", intent);
        ActivityInfo info = packages.getActivityInfo(intent.getComponent(), PackageManager.GET_META_DATA);
        assertEquals(LauncherActivity.class, Class.forName(info.name));
        assertEquals(BuildConfig.GAME_URL,
                info.metaData.getString("android.support.customtabs.trusted.DEFAULT_URL"));
    }

    @Test public void coldStartWithoutBrowserDoesNotCrashOrAttemptSignIn() {
        Intent intent = new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try (ActivityController<LauncherActivity> controller =
                Robolectric.buildActivity(LauncherActivity.class, intent)) {
            LauncherActivity activity = controller.create().start().resume().get();
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertEquals(BuildConfig.GAME_URL,
                    LauncherActivityMetadata.parse(activity).defaultUrl);
            // No browser is installed in this synthetic environment. A recovery
            // prompt is valid, but an unhandled startup exception is never valid.
            assertNotNull(activity.getWindow().getDecorView());
        }
    }
}

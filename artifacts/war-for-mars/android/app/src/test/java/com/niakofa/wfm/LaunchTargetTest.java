package com.niakofa.wfm;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import org.junit.Test;

public class LaunchTargetTest {
    @Test public void acceptsExactStagingRoot() {
        String url = "https://wfm-app-staging-staging.up.railway.app/";
        assertEquals(url, LaunchTarget.requireStaging(url));
    }

    @Test public void rejectsOtherTargetsAndAmbiguousUrls() {
        String[] rejected = {
            null, "", "http://wfm-app-staging-staging.up.railway.app/",
            "https://niakofa.com/kids/wfm/",
            "https://wfm-app-staging-staging.up.railway.app.attacker.invalid/",
            "https://wfm-app-staging-staging.up.railway.app@attacker.invalid/",
            "https://wfm-app-staging-staging.up.railway.app/?token=synthetic",
            "https://wfm-app-staging-staging.up.railway.app/#redirect",
            "https://wfm-app-staging-staging.up.railway.app/sign-in",
            "javascript:alert(1)"
        };
        for (String url : rejected) {
            assertThrows(IllegalArgumentException.class, () -> LaunchTarget.requireStaging(url));
        }
    }
}

package com.niakofa.wfm;

/** Fail closed if this staging application is accidentally built with another target. */
final class LaunchTarget {
    private static final String STAGING_URL =
            "https://wfm-app-staging-staging.up.railway.app/";

    static String requireStaging(String url) {
        if (!STAGING_URL.equals(url)) {
            throw new IllegalArgumentException("WFM staging requires its exact HTTPS game origin");
        }
        return url;
    }

    private LaunchTarget() {}
}

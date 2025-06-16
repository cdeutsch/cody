import type { FeatureFlag } from '@sourcegraph/cody-shared'

/**
 * Logs the enrollment event for the given feature flag ONCE in user's lifetime
 * based on the feature flag key stored in the local storage.
 * NOTE: Update the `getFeatureFlagEventName` function to add new feature flags.
 * Returns true if the user has already been enrolled in the experiment.
 *
 * @param key The feature flag key.
 * @param isEnabled Whether the user has the feature flag enabled or not.
 */
export function logFirstEnrollmentEvent(key: FeatureFlag, isEnabled: boolean): boolean {
    // Check if the user is already enrolled in the experiment or not
    // const isEnrolled = localStorage.getEnrollmentHistory(key);
    // We only want to log the enrollment event once in the user's lifetime.
    // if (!isEnrolled) {
    //   const eventName = getFeatureFlagEventName(key);
    //   const args = { variant: isEnabled ? 'treatment' : 'control' };
    //   telemetryRecorder.recordEvent(`driver.experiment.${eventName}`, 'enrolled', {
    //     privateMetadata: args,
    //   });
    // }
    return true
}

/**
 * Gets the feature flag event name corresponding to the given feature flag key.
 * Matches the feature flag key to the corresponding event name.
 * NOTE: Used for logging events for the feature flag.
 */
// function getFeatureFlagEventName(key: FeatureFlag): string {
//   switch (key) {
//     case FeatureFlag.DeepDriver:
//       return 'deepDriver';
//     case FeatureFlag.DriverPromptCachingOnMessages:
//       return 'promptCachingOnMessages';
//     default:
//       return 'UnregisteredFeature';
//   }
// }

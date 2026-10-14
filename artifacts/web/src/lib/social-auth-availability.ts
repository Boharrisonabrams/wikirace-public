export interface SocialAuthEnvironment {
  apple?: string;
  google?: string;
}

export interface SocialAuthVisibility {
  apple: boolean;
  google: boolean;
  any: boolean;
}

export function resolveSocialAuthVisibility(
  platform: string,
  environment: SocialAuthEnvironment,
): SocialAuthVisibility {
  const google = environment.google === "true";
  const apple = platform === "ios" && environment.apple === "true";

  return { apple, google, any: apple || google };
}

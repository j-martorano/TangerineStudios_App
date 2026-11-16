/**
 * Guías de rotación por tipo de servicio: links directos y pasos que la app le
 * muestra al admin cuando aprieta "Rotar contraseña".
 *
 * Los links de Google y Adobe son las páginas oficiales de cada cuenta. Para
 * Frame.io no hay una URL directa estable de "cambiar contraseña", así que se
 * abre la app y se indica el camino; si el admin encuentra el link exacto lo
 * puede guardar en la credencial ("Link para cambiar la contraseña") y la guía
 * lo usa en vez del genérico.
 */

export const CREDENTIAL_KINDS = ["gmail", "frameio", "adobe", "otro"] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const KIND_LABEL: Record<CredentialKind, string> = {
  gmail: "Gmail / Google",
  frameio: "Frame.io",
  adobe: "Adobe",
  otro: "Otro",
};

export type RotationStep = {
  title: string;
  detail?: string;
  link?: { href: string; label: string };
};

type Preset = {
  loginUrl: string | null;
  changePasswordUrl: string | null;
  steps: (ctx: { changeUrl: string | null; loginUrl: string | null }) => RotationStep[];
};

export const PRESETS: Record<CredentialKind, Preset> = {
  gmail: {
    loginUrl: "https://mail.google.com/",
    changePasswordUrl: "https://myaccount.google.com/signinoptions/password",
    steps: ({ changeUrl }) => [
      {
        title: "Abrí la página de contraseña de Google",
        detail:
          "Entrá con la cuenta compartida. Google te pide la contraseña actual antes de cambiarla: copiala de arriba.",
        link: {
          href: changeUrl ?? "https://myaccount.google.com/signinoptions/password",
          label: "Cambiar contraseña en Google",
        },
      },
      {
        title: "Pegá la contraseña nueva y guardá",
        detail: "Google cierra la sesión en los demás dispositivos al cambiarla.",
      },
      {
        title: "Revisá los dispositivos conectados",
        detail: "Cerrá la sesión de cualquier dispositivo que no reconozcas.",
        link: {
          href: "https://myaccount.google.com/device-activity",
          label: "Ver dispositivos",
        },
      },
      {
        title: "Revisá el teléfono y el mail de recuperación",
        detail:
          "Si la persona que sacaste figura como teléfono o mail de recuperación, o como segundo paso de verificación, puede recuperar la cuenta igual. Sacalo de ahí.",
        link: {
          href: "https://myaccount.google.com/security",
          label: "Seguridad de la cuenta",
        },
      },
    ],
  },
  frameio: {
    loginUrl: "https://next.frame.io/",
    changePasswordUrl: null,
    steps: ({ changeUrl, loginUrl }) => [
      {
        title: "Entrá a Frame.io con el usuario compartido",
        detail: changeUrl
          ? "Usá el link guardado en esta credencial."
          : "Abrí tu perfil (arriba a la derecha) y buscá la configuración de la cuenta, en la sección de contraseña. Si encontrás la URL exacta, guardala en la credencial para la próxima.",
        link: {
          href: changeUrl ?? loginUrl ?? "https://next.frame.io/",
          label: changeUrl ? "Cambiar contraseña en Frame.io" : "Abrir Frame.io",
        },
      },
      {
        title: "Pegá la contraseña nueva y guardá",
        detail: "Frame.io te pide la contraseña actual: copiala de arriba.",
      },
      {
        title: "Probá que la sesión vieja se cerró",
        detail:
          "Frame.io no documenta si cambiar la contraseña cierra las sesiones abiertas. Si hay una opción de cerrar sesión en todos los dispositivos, usala.",
      },
    ],
  },
  adobe: {
    loginUrl: "https://account.adobe.com/",
    changePasswordUrl: "https://account.adobe.com/security",
    steps: ({ changeUrl }) => [
      {
        title: "Abrí la seguridad de la cuenta de Adobe",
        detail: "Buscá la opción para cambiar la contraseña.",
        link: {
          href: changeUrl ?? "https://account.adobe.com/security",
          label: "Seguridad en Adobe",
        },
      },
      {
        title: "Pegá la contraseña nueva y guardá",
      },
      {
        title: "Cerrá la sesión en los demás dispositivos",
        detail: "En la misma página de seguridad está la lista de dispositivos y sesiones.",
      },
    ],
  },
  otro: {
    loginUrl: null,
    changePasswordUrl: null,
    steps: ({ changeUrl, loginUrl }) => [
      {
        title: "Entrá al servicio y buscá dónde cambiar la contraseña",
        link:
          changeUrl || loginUrl
            ? { href: (changeUrl ?? loginUrl)!, label: "Abrir el servicio" }
            : undefined,
      },
      { title: "Pegá la contraseña nueva y guardá" },
      { title: "Si hay opción, cerrá la sesión en los demás dispositivos" },
    ],
  },
};

export function rotationSteps(
  kind: CredentialKind,
  urls: { changePasswordUrl: string | null; loginUrl: string | null }
): RotationStep[] {
  return PRESETS[kind].steps({
    changeUrl: urls.changePasswordUrl,
    loginUrl: urls.loginUrl,
  });
}

export function isCredentialKind(v: string): v is CredentialKind {
  return (CREDENTIAL_KINDS as readonly string[]).includes(v);
}

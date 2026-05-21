import { fetchUserPrefs } from "@/lib/settings/queries";
import { fetchPaymentMethods } from "@/lib/payment-methods/queries";
import { fetchFixedServices } from "@/lib/finanzas/queries";
import { isSeedActive, isSeedOwner } from "@/lib/seed/actions";

import { PrefsClient } from "@/components/configuracion/prefs-client";
import { PaymentMethodsManager } from "@/components/configuracion/payment-methods-manager";
import { SeedSection } from "@/components/configuracion/seed-section";
import { FixedServicesSection } from "@/components/finanzas/fixed-services-section";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [prefs, paymentMethods, fixedServices, seedActive, canSeed] =
    await Promise.all([
      fetchUserPrefs(),
      fetchPaymentMethods(),
      fetchFixedServices(),
      isSeedActive(),
      isSeedOwner(),
    ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-6 md:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus preferencias personales (vistas, columnas, paginación) y los
          catálogos compartidos del workspace.
        </p>
      </header>

      <PrefsClient initialPrefs={prefs} />

      {canSeed ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold tracking-tight">
              Datos de prueba
            </h2>
            <p className="text-xs text-muted-foreground">
              Cargá un set de datos representativo para probar todos los
              comportamientos sin tocar la data real. Es reversible en un click.
            </p>
          </div>
          <SeedSection initialActive={seedActive} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">
            Catálogos compartidos
          </h2>
          <p className="text-xs text-muted-foreground">
            Estos datos los ven todos los usuarios. Cambiarlos afecta al
            workspace entero.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Métodos de pago de editores
          </h3>
          <PaymentMethodsManager methods={paymentMethods} />
        </div>

        <FixedServicesSection services={fixedServices} />
      </section>
    </main>
  );
}

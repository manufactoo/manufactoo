import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MasterDataTable } from "./MasterDataTable";

const PRODUCT_COLUMNS = ["display_name", "default_code", "barcode", "qty_available", "uom_id"];
const BOM_COLUMNS = ["display_name", "product_tmpl_id", "product_qty", "type", "code"];
const MANUFACTURING_ORDER_COLUMNS = ["display_name", "product_id", "product_qty", "qty_producing", "state", "date_start", "date_finished"];
const OPERATOR_COLUMNS = ["name", "barcode", "job_title", "department_id", "work_email"];
// En Odoo el codigo de operario/badge de fichaje se guarda en el campo
// "barcode" de hr.employee (el mismo nombre tecnico que el codigo de barras
// de un producto) -- aqui se traduce como "codigo de empleado" para que no
// se confunda con un codigo de barras fisico.
const OPERATOR_LABELS = { barcode: "masterData.columns.employeeCode" };
const SERIAL_COLUMNS = ["name", "product_id", "ref", "lot_role"];
const WORKCENTER_COLUMNS = ["name", "code"];
const WORKORDER_COLUMNS = ["name", "workcenter_id", "production_id", "state", "qty_producing", "qty_remaining"];

// stock.lot no tiene un campo de "tipo" propio en Odoo -- MasterDataService
// lo deriva de como se ha usado el lote (consumido como componente de una MO,
// producido por una MO, o ambos) y lo manda como "lot_role" en cada fila.
// Ver MasterDataService.enrichLotRoles.
const LOT_ROLE_VARIANT: Record<string, "outline" | "success" | "default" | "secondary"> = {
  RAW_MATERIAL: "outline",
  PRODUCED: "success",
  BOTH: "default",
  UNLINKED: "secondary",
};

export function MasterDataPage() {
  const { t } = useTranslation("dashboard");

  const lotRoleLabel = (role: unknown) => t(`masterData.lotRole.${String(role ?? "UNLINKED").toLowerCase()}`, { defaultValue: String(role) });
  const renderLotRole = (row: Record<string, unknown>) => {
    const role = String(row.lot_role ?? "UNLINKED");
    return <Badge variant={LOT_ROLE_VARIANT[role] ?? "secondary"}>{lotRoleLabel(role)}</Badge>;
  };
  const lotRoleFilter = {
    column: "lot_role",
    label: t("masterData.columns.lot_role"),
    options: Object.keys(LOT_ROLE_VARIANT).map((value) => ({ value, label: lotRoleLabel(value) })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("masterData.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("masterData.subtitle")}</p>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t("masterData.tabs.products")}</TabsTrigger>
          <TabsTrigger value="boms">{t("masterData.tabs.boms")}</TabsTrigger>
          <TabsTrigger value="manufacturingOrders">{t("masterData.tabs.manufacturingOrders")}</TabsTrigger>
          <TabsTrigger value="operators">{t("masterData.tabs.operators")}</TabsTrigger>
          <TabsTrigger value="serials">{t("masterData.tabs.serials")}</TabsTrigger>
          <TabsTrigger value="workcenters">{t("masterData.tabs.workcenters")}</TabsTrigger>
          <TabsTrigger value="workorders">{t("masterData.tabs.workorders")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/products" columns={PRODUCT_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="boms">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/boms" columns={BOM_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manufacturingOrders">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/manufacturing-orders" columns={MANUFACTURING_ORDER_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="operators">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/operators" columns={OPERATOR_COLUMNS} labelOverrides={OPERATOR_LABELS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="serials">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable
                endpoint="/api/master-data/serials"
                columns={SERIAL_COLUMNS}
                cellRenderers={{ lot_role: renderLotRole }}
                filterableColumns={[lotRoleFilter]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="workcenters">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/workcenters" columns={WORKCENTER_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="workorders">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/workorders" columns={WORKORDER_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

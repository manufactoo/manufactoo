import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterDataTable } from "./MasterDataTable";

const PRODUCT_COLUMNS = ["display_name", "default_code", "barcode", "qty_available", "uom_id"];
const BOM_COLUMNS = ["display_name", "product_tmpl_id", "product_qty", "type", "code"];
const MANUFACTURING_ORDER_COLUMNS = ["display_name", "product_id", "product_qty", "state", "date_start", "date_finished"];
const OPERATOR_COLUMNS = ["name", "job_title", "department_id", "work_email"];
const SERIAL_COLUMNS = ["name", "product_id", "ref"];

export function MasterDataPage() {
  const { t } = useTranslation("dashboard");

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
              <MasterDataTable endpoint="/api/master-data/operators" columns={OPERATOR_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="serials">
          <Card>
            <CardContent className="pt-6">
              <MasterDataTable endpoint="/api/master-data/serials" columns={SERIAL_COLUMNS} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

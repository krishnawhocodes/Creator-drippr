import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon, Lock } from "lucide-react";

export default function Wallet() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">
          Manage your creator wallet balance.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            The wallet feature is currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-6">
            <WalletIcon className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-3xl font-bold text-muted-foreground/40">
                ₹0.00
              </p>
              <p className="text-sm text-muted-foreground">
                Available Balance
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" disabled>
              Withdraw Funds
            </Button>
            <Button variant="outline" disabled>
              Transaction History
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Wallet functionality will be enabled in a future update. Your
            earnings are tracked in the Payments section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

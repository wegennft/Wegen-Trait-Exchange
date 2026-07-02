import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/WalletContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { CollectionProvider } from "@/contexts/CollectionContext";
import { Layout } from "@/components/layout/Layout";
import NotFound from "@/pages/not-found";
import { Store } from "@/pages/Store";
import { Locker } from "@/pages/Locker";
import { Nfts } from "@/pages/Nfts";
import { Admin } from "@/pages/Admin";
import { Swap } from "@/pages/Swap";
import { Sandbox } from "@/pages/Sandbox";
import { MyLegends } from "@/pages/MyLegends";
import { Bounties } from "@/pages/Bounties";
import { BundlesPoints } from "@/pages/BundlesPoints";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Store} />
        <Route path="/locker" component={Locker} />
        <Route path="/nfts" component={Nfts} />
        <Route path="/swap" component={Swap} />
        <Route path="/sandbox" component={Sandbox} />
        <Route path="/my-legends" component={MyLegends} />
        <Route path="/bounties" component={Bounties} />
        <Route path="/bundles-points" component={BundlesPoints} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <SiteSettingsProvider>
      <CollectionProvider>
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </WalletProvider>
        </QueryClientProvider>
      </CollectionProvider>
    </SiteSettingsProvider>
  );
}

export default App;

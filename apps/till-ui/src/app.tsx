import { createRoot } from "react-dom/client";
import { About } from "@shopper/ui/components/about";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent, CardFooter } from "@shopper/ui/components/card";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <AppBackdrop className="grid place-items-center">
    <Card className="w-full max-w-md">
      <CardContent>
        <About />
      </CardContent>
      <CardFooter>
        <Button onClick={() => location.reload()}>Reload till</Button>
      </CardFooter>
    </Card>
  </AppBackdrop>,
);

import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageWidget } from "@/components/ui/PageWidget";

export default function NotFound() {
  return (
    <PageWidget site title="No such screen." lead="That page does not exist, or it moved.">
      <ButtonLink href="/">Back home</ButtonLink>
    </PageWidget>
  );
}

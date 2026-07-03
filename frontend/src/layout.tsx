import "./assets/index.css";
import { Head } from "vanilla-bean";

export default function Layout({ children }: { children?: unknown }) {
  return (
    <Fragment>
      <Head>
        <title>frontend</title>
      </Head>
      <main>{children}</main>
    </Fragment>
  );
}

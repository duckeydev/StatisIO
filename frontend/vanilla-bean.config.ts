import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";

export default {
  meta: {
    lang: "en",
    title: "frontend",
    description: "made with create-vanilla-bean",
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
    }
  },
};

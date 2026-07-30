// Registreert de css-stub-loader (zie css-stub-loader.mjs). Gebruik:
//   tsx --import <dit bestand> --test <testbestand>
import { register } from "node:module";
register("./css-stub-loader.mjs", import.meta.url);

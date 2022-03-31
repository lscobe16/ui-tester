import { readLines } from "https://deno.land/std@0.127.0/io/mod.ts";

if (Deno.args[0]) console.log(Deno.args[0]);

for await (const line of readLines(Deno.stdin)) {
    if (line.length > 50) {
        console.log("Error, ight imma head out");
        Deno.exit();
    }
    console.log("Hello, " + line);
}

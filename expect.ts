import {readLines} from "https://deno.land/std@0.127.0/io/mod.ts";
import yargs from 'https://deno.land/x/yargs/deno.ts';
import {Arguments} from "https://deno.land/x/yargs@v17.4.0-deno/deno-types.ts";
import {atNewline, fallback} from "./util.ts";

export const FILENAME = import.meta.url;

if (import.meta.main) {
    const argv: {
        _: string[];
        file: string;
        error: string;
        timeout: number;
    } = yargs(Deno.args)
        .command("$0 <file>", "expect a testfile on stdin", (yargs: Arguments) => {
            yargs.positional("file", {
                type: "string",
                describe: "The test file to test against",
                normalize: true,
            })
        })
        .option("error-prefix", {
            alias: ["error"],
            type: "string",
            default: "Error, ",
            describe: "The output prefix indicating an error"
        })
        .option("timeout", {
            alias: ["t"],
            type: "number",
            default: 1000,
            describe: "The time to wait for answers from the subject in milliseconds"
        })
        .strict()
        .demandCommand()
        .parserConfiguration({"duplicate-arguments-array": false})
        .help()
        .parse();

    if (await expect(argv.file, argv.error, argv.timeout)) {
        Deno.exit(0);
    } else {
        Deno.exit(1);
    }
}

async function expect(file: string, errorPrefix: string, outputTimeout: number) {
    const content = await Deno.readTextFile(file);
    const lines = content.split(atNewline);
    if (lines[lines.length - 1] === "") lines.pop();
    const reader = readLines(Deno.stdin);
    
    let success = true;
    let curProm: Promise<IteratorResult<string>>, needNewProm = true;
    for (const line of lines) {
        if (line.startsWith("$$ ")) {
            // ignore (definitely irrelevant here)
        } else if (line.startsWith("> ")) {
            console.log(line.slice(2)); // write input
        } else if (line.startsWith("#")) {
            console.error(line);
        } else {
            // expecting output
            if (needNewProm) curProm = reader.next();
            const res = await fallback(curProm!, outputTimeout, null);
            if (!res) {
                // did not get new output after timeout
                needNewProm = false;
                console.error("[Expected more output (timeout)]");
                success = false;
            } else {
                needNewProm = true;
                const { done, value: inLine } = res; // read output
                if (done) {
                    // stdin closed -> subject exited
                    console.error("[Subject exited unexpectedly]");
                    success = false;
                    break;
                } else {
                    // got output -> match against expected
                    if (line === "<e") { // expecting error
                        if (!inLine.startsWith(errorPrefix)) {
                            console.error(`[Expected error (starting with '${errorPrefix}')]`);
                            console.error("[     Got]", inLine);
                            success = false;
                        }
                    } else if (line.startsWith("<r ")) { // expecting regex
                        const regex = `^${line.slice(3)}$`;
                        if (!inLine.match(new RegExp(regex))) {
                            console.error(`[Expected match to ${regex}]`);
                            console.error("[     Got]", inLine);
                            success = false;
                        }
                    } else { // expecting exact match
                        const literalLine = line.replace(/^<l /, "");
                        if (inLine !== literalLine) {
                            console.error("[Expected]", literalLine);
                            console.error("[     Got]", inLine);
                            success = false;
                        }
                    }
                }
            }
        }
    }
    
    return success;
}

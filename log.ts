import {readLines} from "https://deno.land/std@0.127.0/io/mod.ts";
import yargs from 'https://deno.land/x/yargs/deno.ts';
import {encoder, runner, wait} from "./util.ts";


if (import.meta.main) {
    const argv: {
        subject: string;
        file: string;
        timeout: number;
    } = yargs(Deno.args)
        .scriptName("log")
        .usage("$0 --subject <subject> --log <filename>")
        .epilog("Log the interaction on the terminal as a test file")
        .option("subject", {
            type: "string",
            demandOption: true,
            describe: "The command of the subject"
        })
        .option("file", {
            alias: ["log"],
            type: "string", 
            demandOption: true,
            describe: "The file to log to",
            normalize: true,
        })
        .option("timeout", {
            alias: ["t"],
            type: "number",
            default: 50,
            describe: "The time to wait for answers from the subject in milliseconds"
        })
        .strict()
        .parserConfiguration({"duplicate-arguments-array": false})
        .help()
        .parse();

    log(argv.subject, argv.file, argv.timeout);
}

export function log(subjectArgs: string, fileName: string, outputTimeout = 50) {
    // create file or clear it if it already existed
    Deno.writeTextFileSync(fileName, "");

    const subject = runner(subjectArgs);

    const outIterator = readLines(subject.stdout);
    const pipeOut = (line: IteratorResult<string>) => {
        if (line.done) {
            console.error("[Subject exited]");
            Deno.exit();
        }
        console.log(line.value);
        write(line.value);
        outIterator.next().then(pipeOut);
    };
    outIterator.next().then(pipeOut);

    const inIterator = readLines(Deno.stdin);
    const pipeIn = async (line: IteratorResult<string>) => {
        write("> " + line.value);
        await subject.stdin.write(encoder.encode(line.value + "\n"));
        await wait(outputTimeout);
        inIterator.next().then(pipeIn);
    };
    inIterator.next().then(pipeIn);

    function write(string: string) {
        // synchronous to ensure chronological order in the file
        Deno.writeTextFileSync(fileName, string + "\n", {append: true});
    }
}

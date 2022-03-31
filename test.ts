import {basename, join} from "https://deno.land/std@0.127.0/path/mod.ts";
import {Arguments} from 'https://deno.land/x/yargs/deno-types.ts';
import yargs from 'https://deno.land/x/yargs/deno.ts';
import {FILENAME as COUPLER_SCRIPT} from "./coupler.ts";
import {atNewline, decoder, replaceExtension, runner} from "./util.ts";

const argv: {
    _: string[];
    dir: boolean;
    file: string;
    error: string;
    extension: string;
    subject?: string;
} = yargs(Deno.args)
    .scriptName("test")
    .usage("$0 <command> <file>")
    .option("dir", {
        alias: ["d", "r"],
        type: "boolean",
        default: false,
        describe: "Apply the command to all tests in the given directory"
    })
    .option("error-prefix", {
        alias: ["error"],
        type: "string",
        default: "Error, ",
        describe: "The output prefix indicating an error"
    })
    .option("extension", {
        alias: ["ext"],
        type: "string",
        default: ".test",
        describe: "The extension that test files have in order to recognize them as such. Ignored if -d is not set",
    })
    .command("split <file>", "split a test file into in and out", (yargs: Arguments) => {
        yargs.positional("file", {
            type: "string",
            describe: "The test file to split",
            normalize: true,
        })
    })
    .command("generalize <file>", "generalize a test file to '<e'", (yargs: Arguments) => {
        yargs.positional("file", {
            type: "string",
            describe: "The test file to generalize",
            normalize: true,
        })
    })
    .command(["run <file>", "test"], "execute a test", (yargs: Arguments) => {
        yargs.usage("run <file> --subject <subject>").positional("file", {
            type: "string",
            describe: "The test file to execute",
            normalize: true,
        }).option("subject", {
            type: "string",
            describe: "The command of the program that is subject to the test",
            demandOption: true,
        })
    })
    .strict()
    .parserConfiguration({"duplicate-arguments-array": false})
    .demandCommand()
    .help().wrap(120)
    .parse();

const command = argv._[0];
let files: string[];

if (argv.dir) {
    files = [...Deno.readDirSync(argv.file)]
        .filter(f => f.isFile && f.name.endsWith(argv.extension))
        .map(f => join(argv.file, f.name));
} else {
    files = [argv.file];
}

// time logging
const times: number[] = [];
const tableWidth = Math.max(30, ...files.map(f => basename(f).length));

if (command === "run") {
    console.log("test".padEnd(tableWidth), "result");
    console.log("-".repeat(tableWidth), "-------");
    console.time("total time");
    await Promise.allSettled(files.map(test));
    console.log();
    console.timeEnd("total time");
    console.log(`average time per test: ${Math.round(times.reduce((a, b) => a + b) / times.length)}ms`)
} else if (command === "split") {
    files.forEach(split);
} else if (command === "generalize") {
    files.forEach(generalize);
}

// FEATURE: allow to run against testers

async function test(filename: string) {
    const begin = new Date().getTime();
    const coupler = runner(
        `deno run --allow-run --allow-read ${COUPLER_SCRIPT} --subject "${argv.subject!}" --expect "${filename}"`,
    true);
    
    // for some (inexplicable) reason order matters here: first await the output
    const out = decoder.decode(await coupler.output());
    const err = decoder.decode(await coupler.stderrOutput());
    
    times.push(new Date().getTime() - begin);
    
    if ((await coupler.status()).success) {
        console.log(basename(filename).padEnd(tableWidth), "success");
    } else {
        const logfile = replaceExtension(filename, ".failed.log");
        console.log(basename(filename).padEnd(tableWidth), `fail (see ${basename(logfile)})`);

        await Deno.writeTextFile(logfile, out);
        console.log("\t" + `wrote a log of the actual output to ${basename(logfile)}`);

        // FEATURE: extract mismatches instead
        console.log("\t" + err.replaceAll("\n", "\n\t"));
    }
}

async function split(filename: string) {
    const content = await Deno.readTextFile(filename);
    const {input, expected} = lines(content);

    Deno.writeTextFile(replaceExtension(filename, ".in"), input.join("\n"));
    Deno.writeTextFile(replaceExtension(filename, ".out"), expected.join("\n"));
}

async function generalize(filename: string) {
    const content = await Deno.readTextFile(filename);
    const lines = content.split(atNewline);
    const generalizedLines = lines.map(l => l.replace(new RegExp(`^${argv.error}.*$`), "<e"));

    Deno.writeTextFile(filename, generalizedLines.join("\n"));
}

function lines(fileContent: string) {
    const lines = fileContent.split(atNewline);
    const args: string[] = [];
    const input: string[] = [];
    const comments: string[] = [];
    const expected: string[] = [];

    for (const line of lines) {
        if (line.startsWith("$$ ")) args.push(line.slice(3));
        else if (line.startsWith("> ")) input.push(line.slice(2));
        else if (line.startsWith("#")) comments.push(line);
        else if (line.startsWith("<l ")) expected.push(line.slice(3));
        else expected.push(line); // generic lines (<e and <r) cannot be transformed
    }

    return {args, input, comments, expected};
}

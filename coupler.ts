import {readLines} from "https://deno.land/std@0.127.0/io/mod.ts";
import yargs from 'https://deno.land/x/yargs/deno.ts';
import {Arguments} from "https://deno.land/x/yargs@v17.4.0-deno/deno-types.ts";
import {FILENAME as EXPECT_SCRIPT} from "./expect.ts";
import {encoder, runner} from "./util.ts";

export const FILENAME = import.meta.url;

if (import.meta.main) {
    const argv: {
        subject: string;
        tester?: string;
        expect?: string;
    } = yargs(Deno.args)
        .scriptName("coupler")
        .usage("$0 --subject <subject> --tester <tester>")
        .usage("$0 --subject <subject> --expect <testfile>")
        .epilog("Link the subject to a tester program (or use the built-in expect tester)")
        .option("subject", {
            type: "string",
            demandOption: true,
            describe: "The command of the subject to test"
        })
        .option("tester", {
            type: "string",
            describe: "The command of the tester",
            conflicts: "expect"
        })
        .option("expect", {
            type: "string",
            describe: "The test file to test against",
            conflicts: "tester"
        })
        .check((argv: Arguments) => !!argv.tester || !!argv.expect || "--tester or --expect required")
        .strict()
        .parserConfiguration({"duplicate-arguments-array": false})
        .help()
        .parse();

    let success = true;
    if (argv.tester) {
        success = await couple(argv.subject, argv.tester);
    } else if (argv.expect) {
        success = await coupleExpecter(argv.subject, argv.expect);
    }
    
    Deno.exit(success ? 0 : 1);
}
function pipeAndLog(from: Deno.Reader, to: Deno.Writer & Deno.Closer, 
                    runnerName: string, logPrefix: string, exit: () => void) {
    const iterator = readLines(from);
    let running = true;

    async function pipeAToB(line: IteratorResult<string>) {
        if (!running || line.done) {
            console.error(`[${runnerName} exited]`);
            to.close(); // this should make process behind 'to' exit
            exit();
            return;
        }
        console.log(logPrefix + line.value);
        await to.write(encoder.encode(line.value + "\n"));
        iterator.next().then(pipeAToB);
    }

    iterator.next().then(pipeAToB);
    return {
        stop: () => running = false
    };
}

export async function coupleExpecter(subjectArgs: string, testFile: string) {
    // FEATURE: use command line arguments from the test file
    return await couple(subjectArgs, `deno run --allow-read ${EXPECT_SCRIPT} ${testFile}`);
}

export async function couple(subjectArgs: string, testerArgs: string) {
    const subject = runner(subjectArgs);
    const tester = runner(testerArgs);

    const pipeA = pipeAndLog(subject.stdout, tester.stdin, "Subject", "", exit);
    const pipeB = pipeAndLog(tester.stdout, subject.stdin, "Tester", "> ", exit);

    let oneExited = false;

    function exit() {
        if (!oneExited) oneExited = true;
        else {
            pipeA.stop();
            pipeB.stop();
        }
    }
    
    // wait for both processes to exit before returning
    await subject.status();
    return (await tester.status()).success;
}

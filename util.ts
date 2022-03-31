import {format, parse} from "https://deno.land/std@0.127.0/path/mod.ts";
import yargs from 'https://deno.land/x/yargs/deno.ts';

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export const atNewline = /\r?\n/g;

export function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function fallback<T, S>(prom: Promise<T>, ms: number, value: S) {
    return Promise.race([
        prom,
        new Promise<S>((resolve) => {
            setTimeout(() => {
                resolve(value);
            }, ms);
        })
    ]);
}

export function splitArguments(string: string) {
    return yargs(("-- " + string) as unknown as any[]).parse()._
        .map((p: string) => ["\"", "'"].includes(p[0]) ? p.slice(1, -1) : p);
}

export function runner(args: string, pipeErr = false) {
    return Deno.run({
        cmd: splitArguments(args),
        cwd: Deno.cwd(),
        stdin: "piped",
        stdout: "piped",
        stderr: pipeErr ? "piped" : "inherit"
    });
}

export function replaceExtension(filename: string, newExtension: string, prepend = false) {
    const parts = parse(filename);
    return format({
        ...parts,
        base: undefined, // remove base such that a new one is created from ext
        ext: (prepend ? parts.ext : "") + newExtension
    });
}


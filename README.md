# UI Tester

This repository contains a set of scripts for testing applications using the `stdin`
and `stdout` streams.

## Installation

You need to have [Deno](https://deno.land) installed and added to the `PATH`.  
To install the scripts globally run:

```shell
deno install --allow-read --allow-write --allow-run ./test.ts
deno install --allow-read --allow-run ./coupler.ts
deno install --allow-read ./expect.ts
deno install --allow-read --allow-write --allow-run ./log.ts
```

## Test File Syntax

A test file (typically ending in `.test`) uses this syntax (taken
from [Codetester](https://github.com/I-Al-Istannen/SimpleCodeTester)):

- A line of input starts with `> `.
- A line of output (with no prefix) is matched exactly.
- A generic error line is indicated by `<e`.
- A line of output is matched by a regular expression after `<r `.
- A line of literal output starts with `<l ` (used for escaping).
- A comment line starts with `#`.
- A line starting with `$$ ` provides one command line argument for the subject but is ignored in this project (yet).

## Usage

You can find out more about additional options by using the `--help` option on any command.

To use the examples below,

- the scripts should be [installed](#installation) and
- you should navigate into the directory [`samples`](./samples) in this repository.

### Test

With this script you can use the `-d` flag alongside a directory instead of a single file to execute the command on all
test files in that folder (no recursion into subfolders). Test files are recognized by the extension provided with the
option `--extension` (default: `.test`).

#### `run`

Run a subject against one or multiple test files.  
If a test fails, a log of the actual, faulty output is written next to the test file.

```shell
test run ./subjectTest_success.test --subject "deno run testSubject.ts"
```

#### `split`

Split a test file into the input and output lines.

```shell
test split -d .
```

#### `generalize`

Generalize a test file by replacing all output lines recognized as errors by the option `--error-prefix` (default:
`Error,`) with `<e`.

```shell
test generalize ./specific.test
```

### Coupler

Link two processes' `stdin` and `stdout` streams and log their communication.

```shell
coupler --subject "deno run testSubject.ts" --tester "deno run testSubject.ts World"
```

> I admit, that using the same programm as the subject and the tester seams confusing at first. The tester is just
> generating new inputs based on the last output from the subject, which itself responds to the inputs.

For usage with test files you can instead use the built-in `expect` tester:

```shell
coupler --subject "deno run testSubject.ts" --expect hello_world.test
```

#### Expect

You will probably never need to use expect on its own, but rather use it through the `coupler` or `test`.

You can specify the prefix of an error message and the maximum time (in milliseconds) to wait for a response from the
subject like this:

```shell
expect subjectTest_success.test --error "Error: " --timeout 5000
```

Together with `coupler` (this test should fail):

```shell
coupler --subject "deno run testSubject.ts" --expect "subjectTest_success.test --error 'Error: ' -t 5000"
```

### Log

Log the interaction with a program on the terminal into a file using the test file syntax. (Most useful for generating
tests manually.)

```shell
log --subject "deno run testSubject.ts" --log log.log
```

import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✖'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  header: (msg: string) => console.log(chalk.bold.underline('\n' + msg)),
  result: (passed: boolean, name: string, caseId: number | null) => {
    const icon = passed ? chalk.green('✔') : chalk.red('✖');
    const caseStr = caseId ? chalk.dim(` [C${caseId}]`) : chalk.yellow(' [no case ID]');
    console.log(`  ${icon} ${name}${caseStr}`);
  },
};

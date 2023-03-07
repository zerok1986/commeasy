#!/usr/bin/env node

import { intro, outro, text, select, confirm, multiselect, isCancel } from '@clack/prompts'
import colors from 'picocolors'
import { trytm } from '@bdsqqq/try'

import { COMMIT_TYPES } from './commit-types.js'
import { exitProgram } from './utils.js'
import { getChangedfiles, getStagedFiles, gitAdd, gitCommit, gitRestore } from './git.js'

intro(
  colors.inverse(`${colors.yellow(' · Commeasy · ')} Commits creation assistant `)
)

const [changedFiles, errorChangedFiles] = await trytm(getChangedfiles())
const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles())

if (errorChangedFiles ?? errorStagedFiles) {
  outro(colors.red('Error: Check you are currently in a valid git repository'))
  process.exit(1)
}

// If NOT changedFiles
if (changedFiles.length === 0) {
  outro(colors.yellow('There are no files to commit'))
  process.exit(0)
}

// If changedFiles but NOT stagedFiles
if (stagedFiles.length === 0 && changedFiles.length > 0) {
  const files = await multiselect({
    message: colors.cyan('Select the files to add to the commit'),
    options: changedFiles.map(file => ({
      value: file,
      label: file
    }))
  })

  if (isCancel(files)) exitProgram()
  await gitAdd({ files })
}

// If BOTH changedFiles and stagedFiles
if (stagedFiles.length > 0 && changedFiles.length > 0) {
  const files = await multiselect({
    message: colors.cyan('Select the changed files to commit'),
    options: changedFiles.map(file => ({
      value: file,
      label: file
    }))
  })

  if (isCancel(files)) exitProgram()
  await gitAdd({ files })
}

// If ONLY stagedFiles
if (stagedFiles.length > 0 || stagedFiles.length > 0 && changedFiles.length === 0) {
  const files = await confirm({
    initialValue: false,
    message: `Confirm the file/s STAGED pending to be commited:
              · ${stagedFiles.map((file) => (file))}`
  })
  if (isCancel(files) || !files) exitProgram()
}

const commitType = await select({
  message: colors.cyan('Select the commit type:'),
  options: Object.entries(COMMIT_TYPES).map(([key, value]) => ({
    value: key,
    label: `${value.emoji} ${key.padEnd(8, ' ')} · ${value.description}`,
  }))
})

if (isCancel(commitType)) {
  gitRestore({ stagedFiles })
  exitProgram()
}

const commitMessage = await text({
  message: colors.cyan('Enter a commit message'),
  validate: (value) => {
    if (value.length === 0) {
      return colors.red('Commit message CANNOT be empty')
    }
    if (value.length > 50) {
      return colors.red('Commit message CANNOT be longer than 50 characters')
    }
  }
})

if (isCancel(commitMessage)) {
  gitRestore({ stagedFiles })
  exitProgram()
}

const { emoji, release } = COMMIT_TYPES[commitType]
let breakingChange = false

if (release) {
  breakingChange = await confirm({
    initialValue: false,
    message: `${colors.cyan('Does this commit changes that could potentially break compatibility?')} 
    
    ${colors.gray('If the answer is YES, you should create a BREAKING CHANGE commit and a major version will be released when published')}`,
  })
}

if (isCancel(breakingChange)) {
  gitRestore({ stagedFiles })
  exitProgram()
}

let commit = `${emoji} ${commitType}: ${commitMessage}`
commit = breakingChange ? `${commit} [BRAKING CHANGE]` : commit

const shouldContinue = await confirm({
  initialValue: true,
  message: `${colors.cyan('Do you want to create the following commit message?:')}
  
  ${colors.green(colors.bold(commit))}
  
  ${colors.cyan('Confirm?')}`
})

if (isCancel(shouldContinue)) {
  gitRestore({ stagedFiles })
  exitProgram()
}

if (!shouldContinue) {
  gitRestore({ stagedFiles })
  outro(colors.yellow('Commit NOT created!'))
  process.exit(0)
}

await gitCommit({ commit })

outro(
  colors.green('✔️ Commit created succesfully!')
)
import waitOn from 'wait-on'
import { cachePrefix, cachePath, serverLogFile, serverPort } from '../constants'
import * as core from '@actions/core'
import { openSync } from 'fs'
import { spawn } from 'child_process'

export const waitForServer = async (): Promise<void> => {
  await waitOn({
    resources: [`http-get://localhost:${serverPort}`],
    timeout: 5000
  })
}

export const exportVariable = (name: string, value: string): void => {
  core.exportVariable(name, value)
  core.info(`  ${name}=${value}`)
}

export async function launchServer(devRun?: boolean): Promise<void> {
  if (!devRun) {
    //* Launch a detached child process to run the server
    // See: https://nodejs.org/docs/latest-v16.x/api/child_process.html#optionsdetached
    const out = openSync(serverLogFile, 'a')
    const err = openSync(serverLogFile, 'a')
    const child = spawn(process.argv[0], [process.argv[1], '--server'], {
      detached: true,
      stdio: ['ignore', out, err]
    })
    child.unref()
    core.info(`Cache version: ${cachePath}`)
    core.info(`Cache prefix: ${cachePrefix}`)
    core.info(`Launched child process: ${child.pid}`)
    core.info(`Server log file: ${serverLogFile}`)
  }

  //* Wait for server
  await waitForServer()
  core.info(`Server is now up and running.`)

  //* Export the environment variables for Turbo
  if (devRun) {
    console.log('Execute:')
    console.log(`export TURBOGHA_PORT=${serverPort}`)
    console.log(`export TURBO_API=http://localhost:${serverPort}`)
    console.log(`export TURBO_TOKEN=turbogha`)
    console.log(`export TURBO_TEAM=turbogha`)
    console.log(
      `export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://localhost:${serverPort}`
    )
    console.log(`export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=default`)
  } else {
    core.info('The following environment variables are exported:')
    exportVariable('TURBOGHA_PORT', `${serverPort}`)
    exportVariable('TURBO_API', `http://localhost:${serverPort}`)
    exportVariable('TURBO_TOKEN', 'turbogha')
    exportVariable('TURBO_TEAM', 'turbogha')
    exportVariable(
      'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
      `http://localhost:${serverPort}`
    )
    exportVariable('NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN', 'default')
  }
}

export async function killServer() {
  //* Kill the server
  await fetch(`http://localhost:${serverPort}/shutdown`, {
    method: 'DELETE'
  })
}

export const parseFileSize = (size: string): number => {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024
  }

  const match = size.toLowerCase().match(/^(\d+)\s*([a-z]+)$/)
  if (!match) {
    throw new Error(`Invalid file size format: ${size}`)
  }

  const [, value, unit] = match
  const multiplier = units[unit]

  if (!multiplier) {
    throw new Error(`Invalid file size unit: ${unit}`)
  }

  return parseInt(value) * multiplier
}

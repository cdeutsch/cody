function buildAgentForTests() {
    // execSync('pnpm run build:for-tests', {
    //     cwd: path.join(__dirname, 'agent'),
    //     stdio: 'inherit',
    // })
}

export default function setup() {
    buildAgentForTests()
}

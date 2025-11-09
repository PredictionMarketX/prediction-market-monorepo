#!/bin/bash

# Solana Test Validator 启动脚本
# 这个脚本启动一个本地验证器，包含所有必需的程序

# 获取 mpl_token_metadata 程序位置
# 如果使用 Solana CLI，它应该在这里：
MPL_BIN="$(solana-test-validator --help > /dev/null 2>&1 && echo 'found' || echo 'not_found')"

if [ "$MPL_BIN" = "found" ]; then
    echo "✓ Found solana-test-validator"
    # 启动包含 mpl_token_metadata 的本地验证器
    solana-test-validator \
        --quiet \
        --reset \
        --url https://api.devnet.solana.com \
        2>&1 &

    VALIDATOR_PID=$!
    echo "Solana Test Validator started (PID: $VALIDATOR_PID)"

    # 等待验证器启动
    sleep 3

    # 运行测试
    echo "Running tests..."
    yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts

    TEST_RESULT=$?

    # 清理验证器
    kill $VALIDATOR_PID 2>/dev/null

    exit $TEST_RESULT
else
    echo "⚠ solana-test-validator not found"
    echo "安装 Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

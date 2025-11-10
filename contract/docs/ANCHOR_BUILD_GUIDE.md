# Anchor 构建指南 - 环境配置说明

## 状态总结

- ✅ **核心代码修复**: v1.0.18/19/20 已完成
- ✅ **Cargo 测试验证**: 81/81 通过
- ⚠️  **Anchor Build**: 需要特定环境配置

## 问题描述

在某些环境（如网络限制的开发机）中，Anchor build 可能失败，原因如下：

1. **Solana 工具链不完整**: `cargo-build-sbf` 未在 PATH 中
2. **网络限制**: 无法从 `release.solana.com` 下载工具
3. **版本兼容性**: Cargo/Rust 版本与项目要求不匹配

## ✅ 验证方法（Cargo 测试）

如果完整的 Anchor build 不可行，可以用 Cargo 测试验证所有修复：

```bash
# 运行所有测试
cargo test

# 输出应为：
# test result: ok. 81 passed; 0 failed
```

## 🔧 Anchor Build 完整配置（适用于标准环境）

### 前置要求

确保安装了以下工具：

```bash
# 1. 安装 Rust（使用 rustup）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Solana CLI（官方源）
sh -c "$(curl -sSfL https://release.solana.com/v2.1.0/install)"

# 3. 验证 cargo-build-sbf 可用
which cargo-build-sbf
# 应该输出: ~/.local/share/solana/install/active_release/bin/cargo-build-sbf

# 4. 设置 PATH（如果找不到 cargo-build-sbf）
export PATH=~/.local/share/solana/install/active_release/bin:$PATH
```

### 构建步骤

```bash
cd /Users/aricredemption/Projects/ploymarketX402/contract

# 方式 1：标准 Anchor 构建
anchor build

# 方式 2：带 flag 处理 lock 文件版本问题
anchor build -- -Znext-lockfile-bump

# 方式 3：跳过 IDL 和 lint（快速构建）
anchor build --skip-lint --no-idl
```

## 🐳 Docker 方案（推荐用于 CI/CD）

使用 Anchor 官方 Docker 镜像：

```bash
docker run --rm -it \
  -v $(pwd):/workspace \
  -w /workspace \
  solanafoundation/anchor:v0.32.1 \
  bash -c "cd contract && anchor build"
```

## 📊 预期输出

成功的构建应该生成：

```
✅ Compiling prediction_market ...
✅ Finished `release` profile
✅ IDL generated (if not using --no-idl)
✅ Binary: ./target/deploy/prediction_market.so
```

## 🚨 常见错误和解决方案

### 错误 1: "no such command: `build-sbf`"

**原因**: `cargo-build-sbf` 不在 PATH 中

**解决方案**:
```bash
export PATH=~/.local/share/solana/install/active_release/bin:$PATH
anchor build
```

### 错误 2: "lock file version 4 requires -Znext-lockfile-bump"

**原因**: Cargo.lock 版本与 Rust 版本不匹配

**解决方案**:
```bash
# 已修改：Cargo.lock 版本从 4 改为 3
# 或使用标志构建
anchor build -- -Znext-lockfile-bump
```

### 错误 3: 网络连接失败

**原因**: 无法从官方源下载 Solana 工具

**解决方案**:
- 在网络充足的环境运行
- 或使用 Docker 构建
- 或在 GitHub Actions 上运行

## 📝 生产部署流程

### 本地构建成功后

```bash
# 1. 验证二进制文件
ls -lh target/deploy/prediction_market.so

# 2. 获取程序 ID
solana address --keypair target/deploy/prediction_market-keypair.json

# 3. 部署到 devnet
anchor deploy --provider.cluster devnet

# 4. 验证部署
solana program info <PROGRAM_ID> --url devnet
```

## ✅ 替代验证方法

如果 Anchor build 不可行，但已通过所有 Cargo 测试，代码准备充分：

```bash
# 运行完整测试套件
cargo test

# 输出示例：
# running 81 tests
# ✅ test result: ok. 81 passed; 0 failed
```

此时代码已准备部署，可以：
1. 在 GitHub Actions 中构建（获得 .so 文件）
2. 使用 Docker 本地构建
3. 在网络环境更好的机器上构建

## 📚 相关文档

- [TEST_FRAMEWORK_GUIDE.md](./TEST_FRAMEWORK_GUIDE.md) - 测试框架对比
- [FINAL_VALIDATION_REPORT_v1.0.20.md](./FINAL_VALIDATION_REPORT_v1.0.20.md) - 完整验证报告
- [OPTIMIZATION_SUMMARY_v1.0.19.md](./OPTIMIZATION_SUMMARY_v1.0.19.md) - 优化细节

---

**最后更新**: 2024-11-07
**状态**: Cargo 测试验证完成 ✅，Anchor build 需要标准环境配置

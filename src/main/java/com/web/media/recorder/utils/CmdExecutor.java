package com.web.media.recorder.utils;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class CmdExecutor {
 
	public static CmdResult execWithOutput(String... command) {
		return exec(true, true, null, command);
	}

	public static boolean execForStatus(String... command) {
		CmdResult result = exec(false, true, null, command);
		return result.isSuccess();
	}

	/**
	 * 执行命令并返回完整结果
	 * 
	 * @param readOutput    是否读取输出流
	 * @param checkExitCode 是否检查退出码（非零时标记为失败）
	 * @param inputBytes    输入字节（可为 null）
	 * @param command       命令参数
	 * @return ProcessResult 包含输出、退出码和错误
	 */
	public static CmdResult exec(boolean readOutput, boolean checkExitCode, byte[] inputBytes, String... command) {

		List<String> output = new ArrayList<>();
		int exitCode = -1;
		Throwable error = null;
		Process process = null;
		try {
			ProcessBuilder pb = new ProcessBuilder(command);
			pb.environment().put("PATH", pb.environment().getOrDefault("PATH", "") + ":/usr/local/bin");
			pb.redirectErrorStream(true);
			// 如果不读取输出，则直接丢弃输出和错误流
			if (!readOutput&&!checkExitCode) {
				pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
				pb.redirectError(ProcessBuilder.Redirect.DISCARD);
			}
			pb.directory(new File(System.getProperty("user.home")));
			process = pb.start();

			// 写入输入数据（如需要）
			if (inputBytes != null) {
				try (OutputStream os = process.getOutputStream()) {
					os.write(inputBytes);
					os.flush();
				}
			}

			// 读取输出流
			if (readOutput) {
				try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
					String line;
					while ((line = reader.readLine()) != null) {
						output.add(line.trim());
					}
				}
			}
			if (checkExitCode) {
				// 等待进程结束并获取退出码
				exitCode = process.waitFor();
			}
		} catch (IOException | InterruptedException e) {
			error = e;
		} finally {
			if (process != null) {
				process.destroy();
			}
		}

		return new CmdResult(output, exitCode, error);
	}

	// 自定义结果对象
	public static class CmdResult {
		private final List<String> output; // 输出内容
		private final int exitCode; // 退出码
		private final Throwable error; // 异常信息

		public CmdResult(List<String> output, int exitCode, Throwable error) {
			this.output = output;
			this.exitCode = exitCode;
			this.error = error;
		}

		// Getters
		public List<String> getOutput() {
			return output;
		}

		public int getExitCode() {
			return exitCode;
		}

		public Throwable getError() {
			return error;
		}

		public boolean isSuccess() {
			return exitCode == 0;
		}
	}

}
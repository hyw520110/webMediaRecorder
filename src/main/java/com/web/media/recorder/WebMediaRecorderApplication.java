package com.web.media.recorder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.web.media.recorder"})
public class WebMediaRecorderApplication {
    public static void main(String[] args) {
        SpringApplication.run(WebMediaRecorderApplication.class, args);
    }
}
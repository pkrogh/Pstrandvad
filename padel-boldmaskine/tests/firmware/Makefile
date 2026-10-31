# Bygger og kører MCU-logikkens unit-tests på PC (kræver g++ eller clang++).
#   make -C tests/firmware test

CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Werror -O1 -g -fsanitize=address,undefined
SRC_DIR  := ../../sketch/src
SOURCES  := $(SRC_DIR)/CommandParser.cpp $(SRC_DIR)/Communication.cpp \
            $(SRC_DIR)/MotorControl.cpp $(SRC_DIR)/StepperControl.cpp \
            $(SRC_DIR)/Scheduler.cpp $(SRC_DIR)/Safety.cpp $(SRC_DIR)/Machine.cpp

.PHONY: test clean

test: test_firmware
	./test_firmware

test_firmware: test_firmware.cpp $(SOURCES) $(wildcard $(SRC_DIR)/*.h)
	$(CXX) $(CXXFLAGS) -I$(SRC_DIR) test_firmware.cpp $(SOURCES) -o $@ -lm

clean:
	rm -f test_firmware

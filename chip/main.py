from capture import capture
from classify import Classify
from notify import Notify

if __name__ == '__main__':
    input_data_1 = []

    classifyObj = Classify()
    notifyObj = Notify()

    while True:
        input_data_2 = capture(128, 3)

        if len(input_data_1) == 0:
            input_data_1 = input_data_2
            continue

        classification = classifyObj.classify(input_data_1 + input_data_2)

        if classification:
            notifyObj.notify()

        input_data_1 = input_data_2
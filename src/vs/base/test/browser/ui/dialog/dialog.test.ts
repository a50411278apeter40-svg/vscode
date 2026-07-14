/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { unthemedButtonStyles } from '../../../../browser/ui/button/button.js';
import { Dialog, IDialogOptions } from '../../../../browser/ui/dialog/dialog.js';
import { KeyCode } from '../../../../common/keyCodes.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../common/utils.js';

const options: Omit<IDialogOptions, 'renderBody' | 'getBodyFocusableElements' | 'isExternalFocusAllowed'> = {
	cancelId: 1,
	buttonStyles: unthemedButtonStyles,
	checkboxStyles: {
		checkboxBackground: undefined,
		checkboxBorder: undefined,
		checkboxForeground: undefined,
		checkboxDisabledBackground: undefined,
		checkboxDisabledForeground: undefined,
	},
	inputBoxStyles: {
		inputBackground: undefined,
		inputForeground: undefined,
		inputBorder: undefined,
		inputValidationInfoBorder: undefined,
		inputValidationInfoBackground: undefined,
		inputValidationInfoForeground: undefined,
		inputValidationWarningBorder: undefined,
		inputValidationWarningBackground: undefined,
		inputValidationWarningForeground: undefined,
		inputValidationErrorBorder: undefined,
		inputValidationErrorBackground: undefined,
		inputValidationErrorForeground: undefined,
	},
	dialogStyles: {
		dialogForeground: undefined,
		dialogBackground: undefined,
		dialogShadow: undefined,
		dialogBorder: undefined,
		errorIconForeground: undefined,
		warningIconForeground: undefined,
		infoIconForeground: undefined,
		textLinkForeground: undefined,
	},
};

function dispatchKey(target: HTMLElement, type: 'keydown' | 'keyup', key: string, keyCode: number, shiftKey = false): KeyboardEvent {
	const event = new KeyboardEvent(type, { key, keyCode, bubbles: true, cancelable: true, shiftKey });
	target.dispatchEvent(event);
	return event;
}

suite('Dialog', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('includes dynamic body controls in Tab order and skips hidden controls', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		disposables.add({ dispose: () => container.remove() });
		let first!: HTMLInputElement;
		let hidden!: HTMLInputElement;
		let second!: HTMLButtonElement;
		const dialog = disposables.add(new Dialog(container, 'Dialog', ['OK', 'Cancel'], {
			...options,
			renderBody: body => {
				first = body.appendChild(document.createElement('input'));
				const hiddenContainer = body.appendChild(document.createElement('div'));
				hiddenContainer.style.display = 'none';
				hidden = hiddenContainer.appendChild(document.createElement('input'));
				second = body.appendChild(document.createElement('button'));
			},
			getBodyFocusableElements: () => [first, hidden, second],
		}));
		const result = dialog.show();

		assert.strictEqual(document.activeElement, first);
		dispatchKey(first, 'keydown', 'Tab', 9);
		assert.strictEqual(document.activeElement, second);
		dispatchKey(second, 'keydown', 'Tab', 9, true);
		assert.strictEqual(document.activeElement, first);

		dialog.dispose();
		await result;
	});

	test('leaves external popup keyboard events to the popup before closing the dialog', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		disposables.add({ dispose: () => container.remove() });
		const popup = document.createElement('div');
		const popupInput = popup.appendChild(document.createElement('input'));
		document.body.append(popup);
		disposables.add({ dispose: () => popup.remove() });
		let trigger!: HTMLButtonElement;
		let guardedCommands = 0;
		const dialog = disposables.add(new Dialog(container, 'Dialog', ['OK', 'Cancel'], {
			...options,
			renderBody: body => {
				trigger = body.appendChild(document.createElement('button'));
			},
			getBodyFocusableElements: () => [trigger],
			isExternalFocusAllowed: target => popup.contains(target),
			keyEventProcessor: event => {
				if (event.equals(KeyCode.KeyP)) {
					guardedCommands++;
					event.preventDefault();
				}
			},
		}));
		let resolved = false;
		const result = dialog.show().finally(() => resolved = true);
		popupInput.focus();

		const guardedKeyDown = dispatchKey(popupInput, 'keydown', 'p', 80);
		const externalKeyDown = dispatchKey(popupInput, 'keydown', 'Escape', 27);
		dispatchKey(popupInput, 'keyup', 'Escape', 27);
		await Promise.resolve();
		assert.deepStrictEqual({
			guardedCommands,
			guardedDefaultPrevented: guardedKeyDown.defaultPrevented,
			defaultPrevented: externalKeyDown.defaultPrevented,
			resolved,
		}, {
			guardedCommands: 1,
			guardedDefaultPrevented: true,
			defaultPrevented: false,
			resolved: false,
		});

		trigger.focus();
		dispatchKey(trigger, 'keydown', 'Escape', 27);
		dispatchKey(trigger, 'keyup', 'Escape', 27);
		assert.strictEqual((await result).button, 1);
	});
});

export default class MessagesDateLimit {
    constructor(mmOptions, which) {
        this.mmOptions = mmOptions;
        this.$checkbox = $(`#${which}-date-use`);
        this.$input = $(`#${which}-date-value`);
        this.optionsField = { from: 'messagesFrom', to: 'messagesTo' }[which];
        this.optionsSetter = 'set' + this.optionsField.charAt(0).toUpperCase() + this.optionsField.substr(1),
            this.dateSuffix = { from: '-01-01', to: '-12-31' }[which];
        this._processing = false;
        if (this.mmOptions[this.optionsField]) {
            this.$input.val([
                this.mmOptions[this.optionsField].getFullYear().toString(),
                ('0' + (this.mmOptions[this.optionsField].getMonth() + 1).toString()).substr(-2),
                ('0' + this.mmOptions[this.optionsField].getDate().toString()).substr(-2),
            ].join('-'));
            this.$checkbox.prop('checked', true);
        } else {
            this.$input.val(((new Date().getFullYear() - 1).toString() + this.dateSuffix));
            this.$checkbox.prop('checked', false);
        }
        this.lastGoodDate = this.$input.val();
        this.$checkbox.on('change', () => {
            this.refreshUI();
            this.updateOptions();
        });
        this.$input.on('input', () => {
            this.updateOptions();
        });
        this.refreshUI();
    }
    set processing(value) {
        this._processing = value;
        this.refreshUI();
    }
    refreshUI() {
        this.$checkbox.attr('disabled', this._processing ? 'disabled' : null);
        this.$input.attr('readonly', this._processing ? 'readonly' : null);
        if (this.$checkbox.is(':checked')) {
            this.$input.removeAttr('disabled');
        } else {
            this.$input.attr('disabled', 'disabled');
        }
    }
    updateOptions() {
        if (this._processing) {
            return;
        }
        const value = this.$checkbox.is(':checked') ? this.$input.val() : null;
        this.mmOptions[this.optionsSetter](value);
    }
}

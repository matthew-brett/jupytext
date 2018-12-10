/* Jupyter notebook extension that allows to configure Jupytext

Inspired from the toc2 extension at https://github.com/ipython-contrib/jupyter_contrib_nbextensions

Test the extension in a Jupyter notebook by adding two cells:

```python
# 1. Install the extension
import notebook.nbextensions
notebook.nbextensions.install_nbextension('jupytext.js', user=True)
# Or, more convenient for developing: replace the installed file with a symbolic link to this one
```

```python
# 2. Load the extension
%%javascript
Jupyter.utils.load_extensions('jupytext')
```

*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
], function (
    requirejs,
    $,
    Jupyter,
    events
) {
        "use strict";

        var show_notebook_settings_dialog = function () {
            if (!('jupytext' in Jupyter.notebook.metadata))
                Jupyter.notebook.metadata.jupytext = {};

            var jpmd = Jupyter.notebook.metadata.jupytext;

            var notebook_path = Jupyter.notebook.notebook_path;
            var notebook_ext = notebook_path.split('.').pop().toLowerCase();
            var script_ext = Jupyter.notebook.metadata.language_info.file_extension;
            var script_language = Jupyter.notebook.metadata.language_info.name;
            script_language = script_language[0].toUpperCase() + script_language.substr(1);

            var modal = $('<div class="modal fade" role="dialog"/>');
            var dialog_content = $("<div/>")
                .addClass("modal-content")
                .appendTo($('<div class="modal-dialog">').appendTo(modal));
            $('<div class="modal-header">')
                .append('<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>')
                .append(`<h3 class="modal-title">Jupytext configuration</h3>`)
                .on('mousedown', function () { $('.modal').draggable({ handle: '.modal-header' }); })
                .appendTo(dialog_content);

            var selected_formats = ("formats" in jpmd && (typeof jpmd.formats === 'string' || jpmd.formats instanceof String)) ? jpmd.formats.split(',') : []
            var text_formats_available = [script_ext.substr(1) + ':light', script_ext.substr(1) + ':percent'];
            if (script_ext === '.py')
                text_formats_available.push('py:sphinx');
            else if (script_ext === '.r')
                text_formats_available.push('r:spin');

            if (notebook_ext === 'ipynb')
                text_formats_available.push('md', 'Rmd');
            else if (notebook_ext === 'md')
                text_formats_available = ['md']
            else if (notebook_ext === 'rmd')
                text_formats_available = ['Rmd'];

            var normalize_format = function (fmt) {
                if (fmt.startsWith('.'))
                    fmt = fmt.substr(1)
                if (fmt.startsWith('md:'))
                    return 'md'
                if (fmt.startsWith('Rmd:'))
                    return 'Rmd'
                return fmt
            }

            selected_formats = selected_formats.map(normalize_format).filter(x => text_formats_available.includes(x))
            var selected_formats_not_ipynb = selected_formats.filter(x => x != 'ipynb')

            var formats_ipynb_readonly = (notebook_ext === 'ipynb') ? "disabled" : "";
            var formats_ipynb = (notebook_ext === 'ipynb' || ("formats" in jpmd && selected_formats.includes('ipynb'))) ? "checked" : "";
            var formats_text = (notebook_ext != 'ipynb' || ("formats" in jpmd && selected_formats_not_ipynb)) ? "checked" : "";
            var formats_text_readonly = (notebook_ext === 'ipynb') ? "" : "disabled";

            var formats_text_select = $('<select/>')
                .attr('id', 'jupytext-formats-text-select')
                .attr('name', 'jupytext-formats');

            var format_description = function (name) {
                if (name.includes(':'))
                    return script_language + ' script (' + name.split(':').pop() + ' format)';
                if (name == 'md')
                    return 'Markdown document'
                if (name == 'Rmd')
                    return 'R Markdown notebook'
            }

            for (var i = 0; i < text_formats_available.length; i++) {
                var name = text_formats_available[i];
                // TODO: can we factorize the below?
                if (selected_formats_not_ipynb.includes(name))
                    formats_text_select.append($('<option/>').attr('name', "jupytext-formats").attr('value', name).attr('selected', 'selected').text(format_description(name)));
                else
                    formats_text_select.append($('<option/>').attr('name', "jupytext-formats").attr('value', name).text(format_description(name)));
            }

            //console.log("comment_magics status", jpmd.comment_magics);
            var comment_magics_default = (!("comment_magics" in jpmd)) ? "checked" : "";
            var comment_magics_true = (jpmd.comment_magics === true) ? "checked" : "";
            var comment_magics_false = (jpmd.comment_magics === false) ? "checked" : "";

            $('<div>')
                .addClass('modal-body')
                .append('<h4>Notebook formats</h4>')
                .append(`<div>Use <a href=https://github.com/mwouts/jupytext>Jupytext</a> and save this notebook as:</div>`)
                .append(`<input type="checkbox" id="jupytext-formats-ipynb" name="jupytext-formats" ${formats_ipynb_readonly} ${formats_ipynb}/>
                         <label>A traditional Jupyter notebook (.ipynb extension)</label><br>`)
                .append(`<input type="checkbox" id="jupytext-formats-text" name="jupytext-formats" ${formats_text_readonly} ${formats_text}/>
                         <label>A </label>`)
                .append(formats_text_select)
                .append(`<div>Hint: Text notebooks are great for version control and for refactoring. You can edit the text notebooks
                outside of Jupyter. Refresh the notebook in Jupyter to load the updated input cells. 
                Output cells are preserved if you save to both text and ipynb formats.</div>`)

                .append(`<h4>Jupyter magic commands</h4>
                <input type="radio" id="jupytext-comment-magics-default" name="jupytext-comment-magics" value="default" ${comment_magics_default}>Default (commented in scripts and Rmd)
                    <input type="radio" id="jupytext-comment-magics-true" name="jupytext-comment-magics" value="true" ${comment_magics_true}>Commented
                    <input type="radio" id="jupytext-comment-magics-false" name="jupytext-comment-magics" value="false" ${comment_magics_false}>Not commented`)

                .appendTo(dialog_content);
            $('<div class="modal-footer">')
                .append('<button class="btn btn-default btn-sm btn-primary" data-dismiss="modal">Ok</button>')
                .appendTo(dialog_content);


            // focus button on open
            modal.on('shown.bs.modal', function () {
                setTimeout(function () {
                    dialog_content.find('.modal-footer button').last().focus();
                    save_jupytext_formats_on_change();
                    save_comment_magics_on_change();
                }, 0);
            });

            return modal.modal({ backdrop: 'static' });
        };

        var save_jupytext_formats_on_change = function () {
            // TODO: this does not work yet when the dropdown list is changed.
            // And: selecting an entry in the dropdown list should check the 'text' checkbox.
            $('input[name=jupytext-formats]').on("change", function () {
                console.log("input[name=jupytext-formats] CHANGED");
                var format_ipynb = $('#jupytext-formats-ipynb').prop('checked')
                var format_text = $('#jupytext-formats-text').prop('checked')

                if (format_ipynb && format_text) {
                    var format_selected = $('#jupytext-formats-text-select option:selected')[0].value
                    Jupyter.notebook.metadata.jupytext.formats = 'ipynb,' + format_selected;
                    console.log('Jupytext formats:' + Jupyter.notebook.metadata.jupytext.formats)
                }
                else
                {
                    delete Jupyter.notebook.metadata.jupytext['formats']
                    console.log('Jupytext formats: null')
                }

                Jupyter.notebook.set_dirty();
            });
        }

        var save_comment_magics_on_change = function () {
            $('input[name=jupytext-comment-magics]').on("change", function () {
                // console.log("input[name=jupytext-comment-magics] CHANGED");
                if ($('#jupytext-comment-magics-default').prop('checked')) {
                    delete Jupyter.notebook.metadata.jupytext["comment_magics"];
                } else if ($('#jupytext-comment-magics-true').prop('checked')) {
                    Jupyter.notebook.metadata.jupytext.comment_magics = true;
                } else if ($('#jupytext-comment-magics-false').prop('checked')) {
                    Jupyter.notebook.metadata.jupytext.comment_magics = false;
                }

                Jupyter.notebook.set_dirty();
            });
        }

        var jupytext_button = function () {
            if (!Jupyter.toolbar) {
                $([Jupyter.events]).on("app_initialized.NotebookApp", jupytext_button);
                return;
            }
            if ($("#jupytext_button").length === 0) {
                $(IPython.toolbar.add_buttons_group([
                    Jupyter.keyboard_manager.actions.register({
                        'help': 'Jupytext',
                        'icon': 'fa-clone', // fa-wrench fa-clone fa-file-alt fa-file-export fa-object-group fa-readme
                        'handler': show_notebook_settings_dialog,
                    }, 'jupytext-button', 'jupytext')
                ])).find('.btn').attr('id', 'jupytext_button');
            }
        };

        var jupytext_init = function () {
            jupytext_button();
        }

        var load_ipython_extension = function () {
            // Wait for the notebook to be fully loaded
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                // this tests if the notebook is fully loaded
                console.log("[jupytext] Notebook fully loaded -- jupytext extension initialized ")
                jupytext_init();
            } else {
                console.log("[jupytext] Waiting for notebook availability")
                events.on("notebook_loaded.Notebook", function () {
                    console.log("[jupytext] jupytext initialized (via notebook_loaded)")
                    jupytext_init();
                })
            }
        };

        return {
            load_ipython_extension: load_ipython_extension
        };
    });

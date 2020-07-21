#!/usr/bin/env python3

import fire
import json
import os
import sys
import numpy as np
import tensorflow as tf
import codecs
import base64

import model, sample, encoder

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

def interact_model(
    model_name='',
    seed=None,
    length=40,
    temperature=0.5,
    top_k=15,
    models_dir='models',
    conversation='subject: hello'
):

    enc = encoder.get_encoder(model_name, models_dir)
    hparams = model.default_hparams()
    with open(os.path.join('models', model_name, 'hparams.json')) as f:
        hparams.override_from_dict(json.load(f))

    if length > hparams.n_ctx:
        raise ValueError("Can't get samples longer than window size: %s" % hparams.n_ctx)

    with tf.compat.v1.Session(graph=tf.Graph()) as sess:
        np.random.seed(seed)
        tf.compat.v1.set_random_seed(seed)
        context = tf.compat.v1.placeholder(tf.int32, [1, None])
        output = sample.sample_sequence(
            hparams=hparams, length=length,
            context=context,
            batch_size=1,
            temperature=temperature, top_k=top_k
        )

        print(conversation)

        while True:
            saver = tf.compat.v1.train.Saver()
            ckpt = tf.train.latest_checkpoint(os.path.join('models', model_name))
            saver.restore(sess, ckpt)
            message = None
            while not message:
                message = input("other: ")
            conversation = base64.b64decode(message).decode("utf-8")
            sys.stdout.write("subject: ")
            sys.stdout.flush()

            encoded_conversation = enc.encode(conversation)
            result = sess.run(output, feed_dict={
                context: [encoded_conversation]
            })[:, len(encoded_conversation):]
            text = enc.decode(result[0])

            splits = text.split('\n')
            reply = splits[0]
            sys.stdout.write(base64.b64encode(reply.encode("utf-8")).decode("utf-8"))
            sys.stdout.write('\n')
            sys.stdout.flush()

if __name__ == '__main__':
    fire.Fire(interact_model)

